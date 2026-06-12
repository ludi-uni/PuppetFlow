use rosc::{OscMessage, OscPacket, OscType};
use std::collections::HashMap;
use std::net::UdpSocket;
use std::sync::Mutex;
use tauri::State;

struct AppState {
    socket: Mutex<UdpSocket>,
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
            args: vec![
                OscType::String(param_name),
                OscType::Float(value),
            ],
        });

        let encoded = rosc::encoder::encode(&packet)
            .map_err(|error| format!("Failed to encode OSC packet: {error}"))?;

        socket
            .send_to(&encoded, format!("{host}:{port}"))
            .map_err(|error| format!("Failed to send OSC packet: {error}"))?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let socket = UdpSocket::bind("0.0.0.0:0").expect("failed to bind UDP socket");

    tauri::Builder::default()
        .manage(AppState {
            socket: Mutex::new(socket),
        })
        .invoke_handler(tauri::generate_handler![osc_send_blend_params])
        .run(tauri::generate_context!())
        .expect("error while running PuppetFlow Studio");
}
