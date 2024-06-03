const registerBtn = document.getElementById("register");
const loginBtn = document.getElementById("login");

const usernameIn = document.getElementById("username");
const passIn = document.getElementById("pass");

registerBtn.addEventListener("click", ev => {
  fetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      username: usernameIn.value,
      pass: passIn.value
    })
  }).then(resp => {
    if (resp.ok) {
      // session cookie will already be set
      window.location.assign("/");
    } else {
      alert("oops, something went wrong when registering; please try again");
    }
  })
  ev.preventDefault();
});

loginBtn.addEventListener("click", ev => {
  fetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: usernameIn.value,
      pass: passIn.value
    })
  }).then(resp => {
    if (resp.ok) {
      // session cookie will be set by fetch
      window.location.assign("/");
    } else {
      alert("oops, something went wrong when registering; please try again");
    }
  })
  ev.preventDefault();
});
