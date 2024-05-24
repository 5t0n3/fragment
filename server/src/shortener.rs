pub mod types {
    use serde::{Deserialize, Serialize};

    #[derive(Serialize, Deserialize)]
    pub struct ShortenerRequest {
        pub url: String,
    }

    #[derive(Deserialize)]
    pub struct ShortenResponse {
        pub long: Option<String>,
        pub short: String,
        pub new: bool,
    }

    #[derive(Deserialize)]
    pub struct LengthenResponse {
        pub long: Option<String>,
        pub short: String,
        pub found: bool,
    }
}

use types::*;

pub async fn expand_shortcode(shortcode: &str) -> Option<String> {
    let shortener_url = std::env::var("SHORTENER_URL").ok()?;

    let client = awc::Client::new();
    let expand_body = ShortenerRequest {
        url: shortcode.to_owned(),
    };

    let response: LengthenResponse = client
        .get(shortener_url + "/lengthen/")
        .query(&expand_body)
        .ok()?
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;

    response.long
}

pub async fn shorten_url(shorten_req: &ShortenerRequest) -> Option<String> {
    let shortener_url = std::env::var("SHORTENER_URL").ok()?;

    let client = awc::Client::new();
    let response: ShortenResponse = client
        .post(shortener_url + "/shorten/")
        .send_json(shorten_req)
        .await
        .ok()?
        .json()
        .await
        .ok()?;

    Some(response.short)
}
