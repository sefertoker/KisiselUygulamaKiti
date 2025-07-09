use super::response::Response;
use sqlx::MySqlPool;
use std::sync::Arc;

pub async fn handle_request(
    method: &str,
    path: &str,
    body_bytes: &[u8], // Changed parameter
    pool: Arc<MySqlPool>,
) -> Response {
    let path_parts: Vec<&str> = path.trim_matches('/').split('/').collect();

    match (method, path_parts.as_slice()) {
        // Auth
        ("POST", ["register"]) => {
            let body = String::from_utf8_lossy(body_bytes).to_string();
            text_response(super::auth::register(pool, body).await)
        }
        ("POST", ["login"]) => {
            let body = String::from_utf8_lossy(body_bytes).to_string();
            text_response(super::auth::login(pool, body).await)
        }

        // Todos
        ("POST", ["todo", "add"]) => {
            let body = String::from_utf8_lossy(body_bytes).to_string();
            text_response(super::todos::add_todo(pool, body).await)
        }
        ("GET", ["todo", "list", user_id]) => {
            text_response(super::todos::list_todos(pool, user_id.to_string()).await)
        }
        ("POST", ["todo", "toggle", user_id, todo_id]) => {
            text_response(super::todos::toggle_todo(pool, user_id.to_string(), todo_id.to_string()).await)
        }
        ("DELETE", ["todo", "delete", user_id, todo_id]) => {
            text_response(super::todos::delete_todo(pool, user_id.to_string(), todo_id.to_string()).await)
        }

        // Media
        ("POST", ["media", "add"]) => {
            let body = String::from_utf8_lossy(body_bytes).to_string();
            text_response(super::media::add_media(pool, body).await)
        },
        ("GET", ["media", "list", user_id, media_type]) => {
            text_response(super::media::list_media(pool, user_id.to_string(), media_type.to_string()).await)
        }
        ("GET", ["media", name]) => {
            match super::media::get_media(pool, name.to_string()).await {
                Ok((bytes, mime_type)) => Response::Binary {
                    status: "200 OK".to_string(),
                    body: bytes,
                    mime_type,
                },
                Err((status, body)) => Response::Text {
                    status,
                    body,
                },
            }
        }
        ("DELETE", ["media", "delete", user_id, media_id]) => text_response(super::media::delete_media(pool, user_id.to_string(), media_id.to_string()).await),

        // CORS Preflight
        ("OPTIONS", _) => Response::Empty("204 No Content".to_string()),

        _ => Response::Text {
            status: "404 Not Found".to_string(),
            body: "Not Found".to_string(),
        },
    }
}

fn text_response((status, body): (String, String)) -> Response {
    Response::Text { status, body }
}
