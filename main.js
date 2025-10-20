// // Main JavaScript for AACEM Institute

// document.addEventListener('DOMContentLoaded', function() {
//     // Initialize tooltips
//     var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
//     var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
//         return new bootstrap.Tooltip(tooltipTriggerEl)
//     })
    
//     // Contact form handling
//     const contactForm = document.getElementById('contactForm');
//     if (contactForm) {
//         contactForm.addEventListener('submit', function(e) {
//             e.preventDefault();
            
//             // Simple form validation
//             const formData = new FormData(contactForm);
//             let isValid = true;
            
//             for (let [key, value] of formData) {
//                 if (!value.trim()) {
//                     isValid = false;
//                     alert(`Please fill in the ${key} field`);
//                     break;
//                 }
//             }
            
//             if (isValid) {
//                 // Simulate form submission
//                 alert('Thank you for your message! We will get back to you soon.');
//                 contactForm.reset();
//             }
//         });
//     }
    
//     // Check if user is logged in (simulated)
//     const authToken = localStorage.getItem('authToken');
//     if (authToken) {
//         updateNavigationForLoggedInUser();
//     }
    
//     // Initialize charts on dashboard pages
//     initializeCharts();
// });

// function updateNavigationForLoggedInUser() {
//     const userRole = localStorage.getItem('userRole');
//     const navBar = document.querySelector('.navbar-nav');
    
//     if (navBar && userRole) {
//         // Remove login/register buttons
//         const authButtons = document.querySelector('.navbar .btn');
//         if (authButtons) {
//             authButtons.parentElement.innerHTML = `
//                 <div class="dropdown">
//                     <button class="btn btn-light dropdown-toggle" type="button" id="userDropdown" data-bs-toggle="dropdown">
//                         <i class="fas fa-user me-1"></i> My Account
//                     </button>
//                     <ul class="dropdown-menu">
//                         <li><a class="dropdown-item" href="dashboard-${userRole}.html">Dashboard</a></li>
//                         <li><a class="dropdown-item" href="#">Profile</a></li>
//                         <li><hr class="dropdown-divider"></li>
//                         <li><a class="dropdown-item" href="#" onclick="logout()">Logout</a></li>
//                     </ul>
//                 </div>
//             `;
//         }
//     }
// }

// function logout() {
//     localStorage.removeItem('authToken');
//     localStorage.removeItem('userRole');
//     window.location.href = 'index.html';
// }

// function initializeCharts() {
//     // Check if Chart.js is available
//     if (typeof Chart === 'undefined') {
//         return;
//     }
    
//     // Enrollment by course chart
//     const enrollmentCtx = document.getElementById('enrollmentChart');
//     if (enrollmentCtx) {
//         new Chart(enrollmentCtx, {
//             type: 'doughnut',
//             data: {
//                 labels: ['DCA', 'ADCA', 'Tally', 'Class 10 CBSE', 'Class 12 BSEB'],
//                 datasets: [{
//                     data: [30, 25, 20, 15, 10],
//                     backgroundColor: [
//                         '#3a0ca3',
//                         '#4361ee',
//                         '#4cc9f0',
//                         '#f72585',
//                         '#7209b7'
//                     ]
//                 }]
//             },
//             options: {
//                 responsive: true,
//                 plugins: {
//                     legend: {
//                         position: 'bottom'
//                     }
//                 }
//             }
//         });
//     }
    
//     // Revenue chart
//     const revenueCtx = document.getElementById('revenueChart');
//     if (revenueCtx) {
//         new Chart(revenueCtx, {
//             type: 'bar',
//             data: {
//                 labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
//                 datasets: [{
//                     label: 'Revenue (in ₹)',
//                     data: [125000, 150000, 175000, 140000, 165000, 190000],
//                     backgroundColor: '#4361ee'
//                 }]
//             },
//             options: {
//                 responsive: true,
//                 scales: {
//                     y: {
//                         beginAtZero: true
//                     }
//                 }
//             }
//         });
//     }
// }

// // API base URL - Update this to your Render backend URL
// const API_BASE_URL = 'https://your-render-app.onrender.com/api';

// // Helper function for API calls
// async function apiCall(endpoint, method = 'GET', data = null) {
//     const options = {
//         method,
//         headers: {
//             'Content-Type': 'application/json',
//             'Authorization': `Bearer ${localStorage.getItem('authToken')}`
//         }
//     };
    
//     if (data) {
//         options.body = JSON.stringify(data);
//     }
    
//     try {
//         const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
//         const result = await response.json();
        
//         if (!response.ok) {
//             throw new Error(result.error || 'API request failed');
//         }
        
//         return result;
//     } catch (error) {
//         console.error('API call error:', error);
//         throw error;
//     }
// }




// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Main JavaScript for AACEM Institute
document.addEventListener('DOMContentLoaded', function() {
    console.log('Document loaded, starting course fetch...');
    
    // Load courses from API
    loadCourses();
    
    // Set current year in footer
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // Contact form handling
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you for your message! We will get back to you soon.');
            contactForm.reset();
        });
    }
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// Load courses from API
async function loadCourses() {
    console.log('Starting to load courses from API...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/courses`);
        console.log('API Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('API Response data:', result);
        
        if (result.success && result.courses && Array.isArray(result.courses)) {
            console.log('Courses found:', result.courses.length);
            
            // Filter active courses by category
            const computerCourses = result.courses.filter(course => 
                course.category === 'computer' && course.is_active !== false
            );
            
            const academicCourses = result.courses.filter(course => 
                course.category === 'academic' && course.is_active !== false
            );
            
            console.log('Computer courses:', computerCourses.length);
            console.log('Academic courses:', academicCourses.length);
            
            // Render courses
            renderComputerCourses(computerCourses);
            renderAcademicCourses(academicCourses);
            
        } else {
            console.error('No courses data found in response');
            showError('No courses available at the moment.');
        }
        
    } catch (error) {
        console.error('Error loading courses:', error);
        showError('Failed to load courses. Please check if the server is running.');
    }
}

// Render computer courses
function renderComputerCourses(courses) {
    const container = document.getElementById('computer-courses-container');
    
    if (!courses || courses.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-4">
                <i class="fas fa-laptop-code fa-3x text-muted mb-3"></i>
                <p class="text-muted">No computer courses available at the moment.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    courses.forEach(course => {
        const durationText = getDurationText(course.duration);
        const feeAmount = parseFloat(course.fee_amount || 0);
        
        html += `
            <div class="course-card" style="background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); transition: transform 0.3s; border: 1px solid #e2e8f0;">
                <div class="course-content" style="padding: 25px;">
                    <h3 class="course-title" style="font-size: 1.4rem; margin-bottom: 5px; color: #3a0ca3; line-height: 1.3;">${course.course_name}</h3>
                    <p class="course-code" style="font-size: 0.9rem; color: #4361ee; font-weight: 600; margin-bottom: 10px; background: rgba(67, 97, 238, 0.1); padding: 4px 8px; border-radius: 4px; display: inline-block;">${course.course_code}</p>
                    <p class="course-description" style="color: #64748b; line-height: 1.5; margin-bottom: 15px; min-height: 40px;">${course.description || 'Comprehensive course covering essential topics'}</p>
                    <div class="course-duration" style="display: flex; align-items: center; margin-bottom: 8px; color: #64748b;">
                        <i class="far fa-clock" style="margin-right: 8px; color: #3a0ca3; width: 16px; text-align: center;"></i>
                        <span>${durationText}</span>
                    </div>
                    <div class="course-fee" style="display: flex; align-items: center; margin-bottom: 8px; font-weight: 600; color: #4bb543;">
                        <i class="fas fa-rupee-sign" style="margin-right: 8px; color: #4bb543; width: 16px; text-align: center;"></i>
                        <span>₹${feeAmount.toLocaleString('en-IN')}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add hover effects
    const courseCards = container.querySelectorAll('.course-card');
    courseCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.15)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.1)';
        });
    });
}

// Render academic courses
function renderAcademicCourses(courses) {
    const container = document.getElementById('academic-courses-container');
    
    if (!courses || courses.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-4">
                <i class="fas fa-book-open fa-3x text-muted mb-3"></i>
                <p class="text-muted">No academic courses available at the moment.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    courses.forEach(course => {
        const durationText = getDurationText(course.duration);
        const feeAmount = parseFloat(course.fee_amount || 0);
        const facultyInfo = getFacultyInfo(course.course_name);
        
        html += `
            <div class="class-card" style="background: white; padding: 25px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; transition: transform 0.3s;">
                <h3 style="color: #3a0ca3; margin-bottom: 15px; font-size: 1.3rem;">${course.course_name}</h3>
                <p class="class-subjects" style="color: #64748b; margin-bottom: 15px; line-height: 1.5;">${course.description || 'Comprehensive academic program'}</p>
                <div class="course-duration" style="display: flex; align-items: center; margin-bottom: 8px; color: #64748b;">
                    <i class="far fa-clock" style="margin-right: 8px; color: #3a0ca3; width: 16px; text-align: center;"></i>
                    <span>${durationText}</span>
                </div>
                <div class="course-fee" style="display: flex; align-items: center; margin-bottom: 8px; font-weight: 600; color: #4bb543;">
                    <i class="fas fa-rupee-sign" style="margin-right: 8px; color: #4bb543; width: 16px; text-align: center;"></i>
                    <span>₹${feeAmount.toLocaleString('en-IN')}</span>
                </div>
                <div class="faculty" style="display: flex; align-items: center; color: #212529; font-weight: 500; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                    <i class="fas fa-chalkboard-teacher" style="margin-right: 10px; color: #3a0ca3;"></i>
                    <span>${facultyInfo}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add hover effects
    const classCards = container.querySelectorAll('.class-card');
    classCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
            this.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.1)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.05)';
        });
    });
}

// Helper function to get duration text
function getDurationText(duration) {
    if (duration === 12) return '12 Months';
    if (duration === 6) return '6 Months';
    if (duration === 3) return '3 Months';
    if (duration === 4) return '4 Months';
    if (duration === 1) return '1 Month';
    return `${duration} Months`;
}

// Helper function to get faculty information based on course name
function getFacultyInfo(courseName) {
    const lowerName = courseName.toLowerCase();
    
    if (lowerName.includes('ix') || lowerName.includes('x')) {
        return 'Multiple Faculty';
    } else if (lowerName.includes('xi') || lowerName.includes('xii')) {
        if (lowerName.includes('science')) {
            return 'Science Faculty';
        } else if (lowerName.includes('commerce')) {
            return 'Commerce Faculty';
        }
    }
    
    return 'Specialized Faculty';
}

// Show error message
function showError(message) {
    const computerContainer = document.getElementById('computer-courses-container');
    const academicContainer = document.getElementById('academic-courses-container');
    
    const errorHtml = `
        <div class="col-12 text-center py-4">
            <div class="alert alert-danger" style="border-radius: 10px; padding: 20px; border: none; background: rgba(220, 53, 69, 0.1); color: #dc3545; border-left: 4px solid #dc3545;">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${message}
            </div>
            <button class="btn btn-primary mt-2" onclick="loadCourses()" style="background: linear-gradient(to right, #3a0ca3, #4361ee); border: none; border-radius: 50px; padding: 10px 25px;">
                <i class="fas fa-redo me-2"></i>Try Again
            </button>
        </div>
    `;
    
    if (computerContainer) {
        computerContainer.innerHTML = errorHtml;
    }
    
    if (academicContainer) {
        academicContainer.innerHTML = errorHtml;
    }
}

// Make loadCourses function globally available for retry button
window.loadCourses = loadCourses;