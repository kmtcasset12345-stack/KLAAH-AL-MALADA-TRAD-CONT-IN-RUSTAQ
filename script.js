const adminUser = { username: "admin", password: "1234" };

function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  if (username === adminUser.username && password === adminUser.password) {
    localStorage.setItem("loggedIn", "true");
    window.location.href = "dashboard.html";
  } else {
    document.getElementById("errorMsg").innerText = "Invalid username or password";
  }
}

document.getElementById("loginForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  login();
});

function logout() {
  localStorage.removeItem("loggedIn");
  window.location.href = "index.html";
}

function go(page) {
  window.location.href = page;
}
