use rosc::{OscBundle, OscMessage, OscPacket, OscTime, OscType};
use serde::Deserialize;
use std::collections::HashMap;
use std::net::UdpSocket;
use std::sync::Mutex;
use std::time::SystemTime;
use tauri::State;

struct AppState {
    socket: Mutex<UdpSocket>,
}

#[derive(Deserialize)]
struct MotionVec3 {
    x: f32,
    y: f32,
    z: f32,
}

#[derive(Deserialize)]
struct MotionQuaternion {
    x: f32,
    y: f32,
    z: f32,
    w: f32,
}

#[derive(Deserialize)]
struct MotionBone {
    name: String,
    position: MotionVec3,
    rotation: MotionQuaternion,
}

#[tauri::command]
fn osc_send_blend_params(
    host: String,
    port: u16,
    params: HashMap<String, f32>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let socket = state
        .socket
        .lock()
        .map_err(|_| "OSC sender lock poisoned".to_string())?;

    for (param_name, value) in params {
        let packet = OscPacket::Message(OscMessage {
            addr: "/VMC/Ext/Blend/Val".to_string(),
            args: vec![OscType::String(param_name), OscType::Float(value)],
        });

        let encoded = rosc::encoder::encode(&packet)
            .map_err(|error| format!("Failed to encode OSC packet: {error}"))?;

        socket
            .send_to(&encoded, format!("{host}:{port}"))
            .map_err(|error| format!("Failed to send OSC packet: {error}"))?;
    }

    Ok(())
}

#[tauri::command]
fn osc_send_motion_frame(
    host: String,
    port: u16,
    bones: Vec<MotionBone>,
    blend_shapes: HashMap<String, f32>,
    timestamp_mode: String,
    timestamp_ms: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut content = Vec::new();
    for bone in bones {
        content.push(OscPacket::Message(OscMessage {
            addr: "/VMC/Ext/Bone/Pos".to_string(),
            args: vec![
                OscType::String(bone.name),
                OscType::Float(bone.position.x),
                OscType::Float(bone.position.y),
                OscType::Float(bone.position.z),
                OscType::Float(bone.rotation.x),
                OscType::Float(bone.rotation.y),
                OscType::Float(bone.rotation.z),
                OscType::Float(bone.rotation.w),
            ],
        }));
    }
    for (param_name, value) in blend_shapes {
        content.push(OscPacket::Message(OscMessage {
            addr: "/VMC/Ext/Blend/Val".to_string(),
            args: vec![OscType::String(param_name), OscType::Float(value)],
        }));
    }

    if content.is_empty() {
        return Ok(());
    }

    let packet = OscPacket::Bundle(OscBundle {
        timetag: resolve_motion_timetag(&timestamp_mode, timestamp_ms)?,
        content,
    });
    let encoded = rosc::encoder::encode(&packet)
        .map_err(|error| format!("Failed to encode OSC motion frame: {error}"))?;
    let socket = state
        .socket
        .lock()
        .map_err(|_| "OSC sender lock poisoned".to_string())?;
    socket
        .send_to(&encoded, format!("{host}:{port}"))
        .map_err(|error| format!("Failed to send OSC motion frame: {error}"))?;
    Ok(())
}

fn resolve_motion_timetag(mode: &str, timestamp_ms: Option<f64>) -> Result<OscTime, String> {
    match mode {
        "immediate" => Ok((0, 1).into()),
        "send-time" => SystemTime::now()
            .try_into()
            .map_err(|error| format!("Failed to resolve OSC send time: {error}")),
        "frame-unix" => {
            let milliseconds =
                timestamp_ms.ok_or_else(|| "frame-unix requires timestamp_ms".to_string())?;
            if !milliseconds.is_finite() || milliseconds < 0.0 {
                return Err("timestamp_ms must be finite and non-negative".to_string());
            }
            let whole = milliseconds.floor();
            let whole_ms = whole as u64;
            let seconds = whole_ms / 1000 + 2_208_988_800;
            if seconds > u32::MAX as u64 {
                return Err("timestamp_ms is outside OSC timetag range".to_string());
            }
            let fraction = (((whole_ms % 1000) as f64 / 1000.0) * 4_294_967_296.0).floor() as u32;
            Ok(OscTime {
                seconds: seconds as u32,
                fractional: fraction,
            })
        }
        _ => Err(format!("unsupported OSC timestamp mode: {mode}")),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let socket = UdpSocket::bind("0.0.0.0:0").expect("failed to bind UDP socket");

    tauri::Builder::default()
        .manage(AppState {
            socket: Mutex::new(socket),
        })
        .invoke_handler(tauri::generate_handler![
            osc_send_blend_params,
            osc_send_motion_frame
        ])
        .run(tauri::generate_context!())
        .expect("error while running PuppetFlow Studio");
}
