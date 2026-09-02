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

fn build_blend_shape_packets(blend_shapes: HashMap<String, f32>) -> Vec<OscPacket> {
    let mut packets = blend_shapes
        .into_iter()
        .map(|(param_name, value)| {
            OscPacket::Message(OscMessage {
                addr: "/VMC/Ext/Blend/Val".to_string(),
                args: vec![OscType::String(param_name), OscType::Float(value)],
            })
        })
        .collect::<Vec<_>>();

    if !packets.is_empty() {
        packets.push(OscPacket::Message(OscMessage {
            addr: "/VMC/Ext/Blend/Apply".to_string(),
            args: vec![],
        }));
    }

    packets
}

fn build_motion_frame_content(
    bones: Vec<MotionBone>,
    blend_shapes: HashMap<String, f32>,
) -> Vec<OscPacket> {
    let mut content = bones
        .into_iter()
        .map(|bone| {
            OscPacket::Message(OscMessage {
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
            })
        })
        .collect::<Vec<_>>();
    content.extend(build_blend_shape_packets(blend_shapes));
    content
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

    for packet in build_blend_shape_packets(params) {
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
    let content = build_motion_frame_content(bones, blend_shapes);

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

#[cfg(test)]
mod tests {
    use super::*;

    fn decode_bundle(content: Vec<OscPacket>) -> OscPacket {
        let encoded = rosc::encoder::encode(&OscPacket::Bundle(OscBundle {
            timetag: (0, 1).into(),
            content,
        }))
        .expect("bundle must encode");
        let (remaining, decoded) = rosc::decoder::decode_udp(&encoded).expect("bundle must decode");
        assert!(remaining.is_empty());
        decoded
    }

    fn message_addresses(packet: OscPacket) -> Vec<String> {
        match packet {
            OscPacket::Bundle(bundle) => bundle
                .content
                .into_iter()
                .map(|packet| match packet {
                    OscPacket::Message(message) => message.addr,
                    OscPacket::Bundle(_) => panic!("motion frame must not nest OSC bundles"),
                })
                .collect(),
            OscPacket::Message(_) => panic!("motion frame must encode as an OSC bundle"),
        }
    }

    fn head_bone() -> MotionBone {
        MotionBone {
            name: "Head".to_string(),
            position: MotionVec3 {
                x: 0.0,
                y: 1.0,
                z: 0.0,
            },
            rotation: MotionQuaternion {
                x: 0.0,
                y: 0.0,
                z: 0.0,
                w: 1.0,
            },
        }
    }

    #[test]
    fn encodes_multiple_blend_values_followed_by_one_apply() {
        let decoded = decode_bundle(build_motion_frame_content(
            Vec::new(),
            HashMap::from([
                ("ExpressionHappy".to_string(), 0.8),
                ("ExpressionSad".to_string(), 0.2),
            ]),
        ));

        assert_eq!(
            message_addresses(decoded),
            vec![
                "/VMC/Ext/Blend/Val",
                "/VMC/Ext/Blend/Val",
                "/VMC/Ext/Blend/Apply",
            ]
        );
    }

    #[test]
    fn encodes_bone_only_frames_without_apply() {
        let decoded = decode_bundle(build_motion_frame_content(
            vec![head_bone()],
            HashMap::new(),
        ));

        assert_eq!(message_addresses(decoded), vec!["/VMC/Ext/Bone/Pos"]);
    }

    #[test]
    fn leaves_empty_frames_without_apply() {
        let content = build_motion_frame_content(Vec::new(), HashMap::new());

        assert!(content.is_empty());
        assert!(content.into_iter().all(|packet| match packet {
            OscPacket::Message(message) => message.addr != "/VMC/Ext/Blend/Apply",
            OscPacket::Bundle(_) => true,
        }));
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
