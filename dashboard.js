// Dashboard JavaScript for AACEM Institute

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        window.location.href = 'login.html';
        return;
    }
    
    // Initialize dashboard components
    initializeDashboard();
});

function initializeDashboard() {
    // Load dashboard data based on user role
    const userRole = localStorage.getItem('userRole');
    
    switch(userRole) {
        case 'admin':
            loadAdminDashboard();
            break;
        case 'teacher':
            loadTeacherDashboard();
            break;
        case 'student':
            loadStudentDashboard();
            break;
        case 'parent':
            loadParentDashboard();
            break;
        default:
            console.error('Unknown user role:', userRole);
    }
}

function loadAdminDashboard() {
    // Simulate loading admin data
    console.log('Loading admin dashboard data...');
    
    // You would typically fetch this data from your API
    const statsData = {
        students: 1250,
        teachers: 48,
        courses: 24,
        revenue: 480000
    };
    
    // Update stats cards
    document.querySelectorAll('.stats-number').forEach((el, index) => {
        const values = Object.values(statsData);
        if (index < values.length) {
            el.textContent = index === 3 ? `₹${(values[index]/1000).toFixed(1)}L` : values[index].toLocaleString();
        }
    });
}

function loadTeacherDashboard() {
    // Simulate loading teacher data
    console.log('Loading teacher dashboard data...');
}

function loadStudentDashboard() {
    // Simulate loading student data
    console.log('Loading student dashboard data...');
}

function loadParentDashboard() {
    // Simulate loading parent data
    console.log('Loading parent dashboard data...');
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    window.location.href = 'index.html';
}