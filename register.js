document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const role = document.getElementById('role').value;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const courseInterest = document.getElementById('courseInterest').value;

    const registerBtn = this.querySelector('button[type="submit"]');
    registerBtn.disabled = true;
    registerBtn.innerHTML= `<span class="spinner-border spinner-border-sm me-2"></span> Registering...`;

    fetch('http://127.0.0.1:5000/register', {   // ab Flask 5000 pe chalega
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({fullName, email, phone, role, username, password, courseInterest})
})


    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if (data.success) window.location.href = "choose-login.html";
        registerBtn.disabled = false;
        registerBtn.textContent = "Register Now";
    })
    .catch(err => {
        console.error(err);
        alert("Something went wrong!");
        
        registerBtn.disabled = false;
        registerBtn.textContent = "Register Now";
    });
});
