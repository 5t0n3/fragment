use actix_web::{
    get, http::header, post, web, App, HttpRequest, HttpResponse, HttpServer, Responder,
};
use log::{debug, info};

mod shortener;
use shortener::types::ShortenerRequest;

// disk reads are slow right? :^)
const INDEX_HTML: &str = include_str!("frontend/index.html");
const ACCOUNT_HTML: &str = include_str!("frontend/account.html");
const ACCOUNT_JS: &str = include_str!("frontend/account.js");
const LIST_HTML: &str = include_str!("frontend/list.html");
const LIST_JS: &str = include_str!("frontend/list.js");
const CSS: &str = include_str!("frontend/style.css");
const CLIENT_SCRIPT: &str = include_str!("frontend/index.js");
const LOGO: &[u8] = include_bytes!("frontend/logo.png");
const ICON: &[u8] = include_bytes!("frontend/favicon.ico");

#[get("/style.css")]
async fn style() -> impl Responder {
    HttpResponse::Ok()
        .content_type(header::ContentType(mime::TEXT_CSS))
        .body(CSS)
}

#[get("/index.js")]
async fn script() -> impl Responder {
    HttpResponse::Ok()
        .content_type(header::ContentType(mime::TEXT_JAVASCRIPT))
        .body(CLIENT_SCRIPT)
}

#[get("/logo.png")]
async fn logo() -> impl Responder {
    HttpResponse::Ok()
        .content_type(header::ContentType::png())
        .body(LOGO)
}

#[get("/favicon.ico")]
async fn icon() -> impl Responder {
    HttpResponse::Ok().body(ICON)
}

#[get("/note")]
async fn index() -> impl Responder {
    HttpResponse::Ok()
        .insert_header((
            // only allow scripts/styles/images from this server (i.e. no inline/external stuff)
            header::CONTENT_SECURITY_POLICY,
            header::HeaderValue::from_static(
                "default-src 'none'; script-src 'sha512-pKjv7qPE9+Ei0Q0xNpAw9+6z5Fj4mEE7TnTKXExu9ZYk3s9FG7idOXGgIEYAoSxwUlgjyEbvMZalK14rsPvuBg=='; style-src 'self'; img-src 'self'; connect-src 'self'",
            ),
        ))
        .body(INDEX_HTML)
}

#[get("/robots.txt")]
async fn robots_txt() -> impl Responder {
    HttpResponse::Ok().body("User-agent: *\nDisallow: /")
}

#[get("/account.js")]
async fn account_js() -> impl Responder {
    HttpResponse::Ok()
        .content_type(header::ContentType(mime::TEXT_JAVASCRIPT))
        .body(ACCOUNT_JS)
}

#[get("/account")]
async fn account_page() -> impl Responder {
    HttpResponse::Ok()
        .insert_header((
            // match CSP for index
            header::CONTENT_SECURITY_POLICY,
            header::HeaderValue::from_static(
                "default-src 'none'; script-src 'sha512-xHhCiHe3DywvoyeuaH64ego0omq0SspLY2745+AHZzBzooOj2I08JLGbY8fLqkR+hhvR9gEWjnUtMdAi+sLRyw=='; style-src 'self'; img-src 'self'; connect-src 'self'",
            ),
        ))
        .body(ACCOUNT_HTML)
}

#[get("/list")]
async fn list_notes() -> impl Responder {
    HttpResponse::Ok()
        .insert_header((
            // match CSP for index (sans script)
            header::CONTENT_SECURITY_POLICY,
            header::HeaderValue::from_static(
                "default-src 'none'; script-src 'sha512-CrlAIL8qeOwYxfBGxLeGJ9FpUB/7DgJ0kJhfOUphINRdXrYMIyaynz6DJerZkgq3pT/MebObpxweygWfet+5cg=='; style-src 'self'; img-src 'self'; connect-src 'self'",
            ),
        ))
        .body(LIST_HTML)
}

#[get("/list.js")]
async fn list_js() -> impl Responder {
    HttpResponse::Ok()
        .content_type(header::ContentType(mime::TEXT_JAVASCRIPT))
        .body(LIST_JS)
}

#[get("/s/{code}")]
async fn expand_url(req: HttpRequest) -> HttpResponse {
    if let Ok(fragment_url) = std::env::var("FRAGMENT_URL") {
        let full_url = format!("{fragment_url}{}", req.uri());

        shortener::expand_url(&full_url).await.map_or_else(
            |err| {
                debug!("Error when expanding short URL: {}", err.to_string());
                HttpResponse::NotFound().body("Short URL not found")
            },
            |target| {
                HttpResponse::TemporaryRedirect()
                    .insert_header((header::LOCATION, target))
                    .finish()
            },
        )
    } else {
        HttpResponse::NotImplemented().body("URL shortening not configured")
    }
}

#[post("/shorten")]
async fn shorten_url(shorten_body: web::Json<ShortenerRequest>) -> HttpResponse {
    let inner_req = shorten_body.into_inner();

    if let Ok(fragment_url) = std::env::var("FRAGMENT_URL") {
        // ensure requested URL is an actual fragment URL
        if !inner_req.url.starts_with(&fragment_url) {
            HttpResponse::BadRequest().body("Invalid URL provided")
        } else {
            // just forward request directly to shortener microservice
            shortener::shorten_url(&inner_req).await.map_or_else(
                |err| {
                    debug!("Error when expanding short URL: {}", err.to_string());
                    HttpResponse::InternalServerError()
                        .body("Internal server error when shortening URL")
                },
                |shortened| HttpResponse::Ok().body(shortened),
            )
        }
    } else {
        HttpResponse::NotImplemented().body("URL shortening not configured")
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // use custom environment varaible for logging
    let log_env = env_logger::Env::default().filter_or("FRAGMENT_LOG_LEVEL", "info");
    env_logger::init_from_env(log_env);

    info!("Logging initialized! Binding to port 8080...");
    HttpServer::new(|| {
        App::new()
            .service(index)
            .service(account_page)
            .service(account_js)
            .service(list_notes)
            .service(list_js)
            .service(script)
            .service(style)
            .service(robots_txt)
            .service(logo)
            .service(icon)
            .service(shorten_url)
            .service(expand_url)
            .service(web::redirect("/", "/note"))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
