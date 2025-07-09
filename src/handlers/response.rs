pub enum Response {
    Text {
        status: String,
        body: String,
    },
    Binary {
        status: String,
        body: Vec<u8>,
        mime_type: String,
    },
    Empty(String), // Sadece durum kodu (örn: CORS preflight için)
}
