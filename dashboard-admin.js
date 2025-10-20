const api = "https://aacem-backend.onrender.com"


// Global variables
let studentsData = [];
let teachersData = [];
let coursesData = [];
let feesData = [];
let attendanceData = [];
let marksData = [];
let notificationsData = [];
let currentEditId = null;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initializing...');
    loadDashboardData();
    loadNotifications();
    setupModalListeners();
    setupSearchFunctionality();
});

// Setup modal event listeners
function setupModalListeners() {
    console.log('Setting up modal listeners...');
    const modals = ['studentModal', 'teacherModal', 'feeModal', 'marksModal', 'attendanceModal', 'notificationModal', 'reportModal', 'courseModal', 'settingsModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('hidden.bs.modal', function() {
                const form = this.querySelector('form');
                if (form) {
                    form.reset();
                    resetModalToAddMode(modalId);
                }
            });
        }
    });

    // Populate dropdowns when modals open
    document.getElementById('feeModal').addEventListener('show.bs.modal', function() {
        console.log('Fee modal opened');
        populateStudentDropdown('feeForm');
    });

    document.getElementById('marksModal').addEventListener('show.bs.modal', function() {
        console.log('Marks modal opened');
        populateStudentDropdown('marksForm');
    });

    document.getElementById('studentModal').addEventListener('show.bs.modal', function() {
        console.log('Student modal opened');
        populateCourseDropdown('studentForm', 'course');
    });

    // FIXED: Attendance modal population
    document.getElementById('attendanceModal').addEventListener('show.bs.modal', async function() {
        console.log('Attendance modal opened - ensuring courses are loaded');
        
        // Ensure courses are loaded before populating dropdown
        const coursesLoaded = await ensureCoursesLoaded();
        
        if (coursesLoaded) {
            populateCourseDropdown('attendanceForm', 'class');
        } else {
            const select = document.querySelector('#attendanceForm select[name="class"]');
            if (select) {
                select.innerHTML = '<option value="">No courses available. Please add courses first.</option>';
            }
        }
        
        // Set current date
        const dateInput = this.querySelector('input[type="date"]');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        
        // Clear previous students list
        const container = document.getElementById('attendanceStudentsList');
        if (container) {
            container.innerHTML = '<p class="text-muted text-center p-3">Select a class and date to load students</p>';
        }
    });

    // Set current date for relevant modals
    document.getElementById('feeModal').addEventListener('show.bs.modal', function() {
        const dateInput = this.querySelector('input[type="date"]');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    });

    document.getElementById('marksModal').addEventListener('show.bs.modal', function() {
        const dateInput = this.querySelector('input[type="date"]');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    });
}

// Enhanced function to handle course loading
async function ensureCoursesLoaded() {
    if (coursesData.length === 0) {
        console.log('No courses in cache, loading courses...');
        try {
            const response = await fetch('http://localhost:5000/api/courses');
            const data = await response.json();
            if (data.success) {
                coursesData = data.courses || [];
                console.log('Courses loaded:', coursesData.length);
                return true;
            } else {
                console.error('Failed to load courses:', data.message);
                return false;
            }
        } catch (error) {
            console.error('Error loading courses:', error);
            return false;
        }
    }
    return coursesData.length > 0;
}

// Setup search functionality
function setupSearchFunctionality() {
    const studentSearch = document.getElementById('studentSearch');
    const teacherSearch = document.getElementById('teacherSearch');
    
    if (studentSearch) {
        studentSearch.addEventListener('input', function(e) {
            filterTable('studentsTableBody', e.target.value.toLowerCase());
        });
    }
    
    if (teacherSearch) {
        teacherSearch.addEventListener('input', function(e) {
            filterTable('teachersTableBody', e.target.value.toLowerCase());
        });
    }
}

// Filter table rows
function filterTable(tableBodyId, searchTerm) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    
    const rows = tbody.getElementsByTagName('tr');
    
    for (let row of rows) {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    }
}

// Toggle notifications panel
function toggleNotifications() {
    const panel = document.getElementById('notificationPanel');
    if (panel) {
        panel.classList.toggle('open');
    }
}

// Show dashboard
function showDashboard() {
    const studentsTab = document.getElementById('students-tab');
    if (studentsTab) {
        studentsTab.click();
    }
}

// Load all dashboard data
async function loadDashboardData() {
    try {
        showLoading('dashboardStats');
        console.log('Loading dashboard data...');
        
        const response = await fetch('http://localhost:5000/api/dashboard-data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Update data arrays
            studentsData = data.students || [];
            teachersData = data.teachers || [];
            coursesData = data.courses || [];
            feesData = data.fees || [];
            attendanceData = data.attendance || [];
            marksData = data.marks || [];
            notificationsData = data.notifications || [];
            
            console.log('Data loaded successfully:');
            console.log(`- Students: ${studentsData.length}`);
            console.log(`- Teachers: ${teachersData.length}`);
            console.log(`- Courses: ${coursesData.length}`);
            console.log(`- Active Courses: ${coursesData.filter(c => c.is_active).length}`);
            
            if (coursesData.length > 0) {
                console.log('Sample course:', coursesData[0]);
            }
            
            // Update UI with data
            updateStudentsTable();
            updateTeachersTable();
            updateCoursesTable();
            updateFeesTable();
            updateAttendanceTable();
            updateMarksTable();
            updateNotifications();
            
            // Update stats
            updateDashboardStats(data.stats);
            
            showSuccess('Dashboard data loaded successfully');
            
        } else {
            console.error('Failed to load dashboard data:', data.message);
            showError('Failed to load dashboard data: ' + data.message);
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to connect to server: ' + error.message);
    } finally {
        hideLoading('dashboardStats');
    }
}

// Update dashboard statistics
function updateDashboardStats(stats) {
    const totalStudents = document.getElementById('totalStudents');
    const totalTeachers = document.getElementById('totalTeachers');
    const totalCourses = document.getElementById('totalCourses');
    const totalRevenue = document.getElementById('totalRevenue');
    
    if (totalStudents) totalStudents.textContent = stats.total_students || 0;
    if (totalTeachers) totalTeachers.textContent = stats.total_teachers || 0;
    if (totalCourses) totalCourses.textContent = stats.total_courses || 0;
    
    const revenue = stats.total_revenue || 0;
    if (totalRevenue) totalRevenue.textContent = '₹' + revenue.toLocaleString();
    
    updateNotificationBadge();
}

// Show loading state
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('loading');
    }
}

// Hide loading state
function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('loading');
    }
}

// Show error message
function showError(message) {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
        syncStatus.className = 'sync-status bg-danger text-white';
        syncStatus.innerHTML = `<i class="fas fa-exclamation-circle me-2"></i> ${message}`;
        syncStatus.style.display = 'block';
        
        setTimeout(() => {
            syncStatus.style.display = 'none';
        }, 5000);
    }
    
    // Also show alert for important errors
    console.error('Error:', message);
}

// Show success message
function showSuccess(message) {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
        syncStatus.className = 'sync-status bg-success text-white';
        syncStatus.innerHTML = `<i class="fas fa-check-circle me-2"></i> ${message}`;
        syncStatus.style.display = 'block';
        
        setTimeout(() => {
            syncStatus.style.display = 'none';
        }, 3000);
    }
}

// Load notifications
async function loadNotifications() {
    try {
        const response = await fetch('http://localhost:5000/api/notifications');
        const data = await response.json();
        
        if (data.success) {
            notificationsData = data.notifications || [];
            updateNotifications();
            updateNotificationBadge();
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Update notification badge
function updateNotificationBadge() {
    const badge = document.getElementById('notificationCount');
    if (badge) {
        const unreadCount = notificationsData.length;
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
}

// Update notifications in the panel
function updateNotifications() {
    const notificationList = document.getElementById('notificationList');
    if (!notificationList) return;
    
    notificationList.innerHTML = '';
    
    if (notificationsData.length === 0) {
        notificationList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications</p>
            </div>
        `;
        return;
    }
    
    notificationsData.forEach(notification => {
        const priorityClass = notification.priority === 'high' ? 'border-danger' : 
                            notification.priority === 'medium' ? 'border-warning' : 'border-info';
        
        const notificationElement = document.createElement('div');
        notificationElement.className = `card mb-2 ${priorityClass} notification-item`;
        notificationElement.innerHTML = `
            <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="card-title mb-0">${notification.title || 'No Title'}</h6>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="#" onclick="editNotification(${notification.id})"><i class="fas fa-edit me-2"></i>Edit</a></li>
                            <li><a class="dropdown-item text-danger" href="#" onclick="deleteNotification(${notification.id})"><i class="fas fa-trash me-2"></i>Delete</a></li>
                        </ul>
                    </div>
                </div>
                <p class="card-text mb-2">${notification.message || 'No message'}</p>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${formatDate(notification.created_at)}</small>
                    <div>
                        <span class="badge bg-${notification.audience === 'students' ? 'info' : notification.audience === 'teachers' ? 'warning' : 'primary'} me-1">${notification.audience || 'all'}</span>
                        <span class="badge bg-${notification.priority === 'high' ? 'danger' : notification.priority === 'medium' ? 'warning' : 'info'}">${notification.priority || 'medium'}</span>
                    </div>
                </div>
            </div>
        `;
        notificationList.appendChild(notificationElement);
    });
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
        return 'Invalid Date';
    }
}

// Populate student dropdown in forms
function populateStudentDropdown(formId) {
    const select = document.querySelector(`#${formId} select[name="studentId"]`);
    if (!select) {
        console.error(`Student dropdown not found for form: ${formId}`);
        return;
    }
    
    console.log(`Populating student dropdown for ${formId} with ${studentsData.length} students`);
    
    select.innerHTML = '<option value="">Select Student</option>';
    
    if (studentsData.length === 0) {
        console.warn('No students data available');
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No students available';
        option.disabled = true;
        select.appendChild(option);
        return;
    }
    
    studentsData.forEach(student => {
        const option = document.createElement('option');
        option.value = student.student_id;
        option.textContent = `${student.name || 'Unknown'} (${student.student_id}) - ${student.course || 'No Course'}`;
        select.appendChild(option);
    });
    
    console.log(`Populated ${select.options.length - 1} students`);
}

// FIXED: Populate course dropdown in forms with dynamic field name
function populateCourseDropdown(formId, fieldName = 'course') {
    const select = document.querySelector(`#${formId} select[name="${fieldName}"]`);
    if (!select) {
        console.error(`Course dropdown not found for form: ${formId}, field: ${fieldName}`);
        return;
    }
    
    console.log(`Populating course dropdown for ${formId} with ${coursesData.length} courses`);
    console.log('Available courses:', coursesData);
    
    select.innerHTML = '<option value="">Select Course</option>';
    
    if (coursesData.length === 0) {
        console.warn('No courses data available');
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No courses available';
        option.disabled = true;
        select.appendChild(option);
        return;
    }
    
    let activeCoursesCount = 0;
    coursesData.forEach(course => {
        // Check if course is active (default to true if not specified)
        if (course.is_active !== false) {
            const option = document.createElement('option');
            option.value = course.course_code;
            option.textContent = `${course.course_name || 'Unnamed Course'} (${course.course_code})`;
            option.setAttribute('data-fee', course.fee_amount || 0);
            select.appendChild(option);
            activeCoursesCount++;
        }
    });
    
    console.log(`Populated ${activeCoursesCount} active courses out of ${coursesData.length} total courses`);
    
    if (activeCoursesCount === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No active courses available';
        option.disabled = true;
        select.appendChild(option);
    }
}

// Update fee details when student is selected
function updateFeeDetails(studentId) {
    const student = studentsData.find(s => s.student_id === studentId);
    if (student) {
        const totalFeeInput = document.querySelector('#feeForm input[name="totalFee"]');
        const paidAmountInput = document.querySelector('#feeForm input[name="paidAmount"]');
        const dueAmountInput = document.querySelector('#feeForm input[name="dueAmount"]');
        const payingInput = document.querySelector('#feeForm input[name="payingNow"]');
        
        if (totalFeeInput) totalFeeInput.value = student.fee_amount || 0;
        if (paidAmountInput) paidAmountInput.value = student.paid_amount || 0;
        if (dueAmountInput) dueAmountInput.value = student.due_amount || 0;
        
        // Set maximum paying amount
        if (payingInput) {
            payingInput.max = student.due_amount || 0;
            payingInput.placeholder = `Max: ${student.due_amount || 0}`;
        }
    }
}

// FIXED: Load students for attendance marking
async function loadClassStudents(className) {
    const container = document.getElementById('attendanceStudentsList');
    const dateInput = document.querySelector('#attendanceForm input[name="date"]');
    
    if (!container) {
        console.error('Attendance students container not found');
        return;
    }
    
    if (!dateInput || !dateInput.value) {
        container.innerHTML = '<p class="text-warning text-center p-3">Please select a date first</p>';
        return;
    }
    
    const selectedDate = dateInput.value;
    
    if (!className) {
        container.innerHTML = '<p class="text-warning text-center p-3">Please select a class first</p>';
        return;
    }
    
    console.log(`Loading students for class: ${className} on date: ${selectedDate}`);
    
    container.innerHTML = '<div class="text-center p-3"><div class="loading-spinner"></div> Loading students...</div>';
    
    try {
        // Check if attendance already exists for this date and class
        const checkResponse = await fetch(`http://localhost:5000/api/attendance/check-existing?date=${selectedDate}&class=${className}`);
        const checkResult = await checkResponse.json();
        
        let existingAttendance = null;
        if (checkResult.success && checkResult.exists) {
            existingAttendance = checkResult.attendance;
            console.log('Found existing attendance:', existingAttendance);
        }
        
        // Load students for the class
        const response = await fetch(`http://localhost:5000/api/attendance/students/${className}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        container.innerHTML = '';
        
        if (!result.success || !result.students || result.students.length === 0) {
            container.innerHTML = '<p class="text-muted text-center p-3">No students found for this class</p>';
            return;
        }
        
        console.log(`Loaded ${result.students.length} students for attendance`);
        
        // Show warning if attendance already exists
        if (existingAttendance) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'alert alert-warning mb-3';
            warningDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Attendance already marked for ${selectedDate}</strong>
                        <p class="mb-0 mt-1">Present: ${existingAttendance.present_count} | Absent: ${existingAttendance.absent_count} | Percentage: ${existingAttendance.percentage}%</p>
                    </div>
                    <button class="btn btn-sm btn-outline-warning" onclick="loadExistingAttendance('${existingAttendance.id}')">
                        <i class="fas fa-edit me-1"></i> Edit
                    </button>
                </div>
            `;
            container.appendChild(warningDiv);
        }
        
        result.students.forEach(student => {
            const studentDiv = document.createElement('div');
            studentDiv.className = 'form-check mb-3 p-3 border rounded bg-light';
            
            // Check if student was present in existing attendance
            let isChecked = true; // Default to present
            let badgeClass = 'bg-success';
            let badgeText = 'Present';
            
            if (existingAttendance && existingAttendance.attendance_data) {
                const existingStatus = existingAttendance.attendance_data[student.student_id];
                isChecked = existingStatus === 'present';
                badgeClass = isChecked ? 'bg-success' : 'bg-danger';
                badgeText = isChecked ? 'Present' : 'Absent';
            }
            
            studentDiv.innerHTML = `
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                        <input class="form-check-input attendance-checkbox" type="checkbox" 
                               data-student-id="${student.student_id}" 
                               id="attendance_${student.student_id}" 
                               ${isChecked ? 'checked' : ''}>
                        <label class="form-check-label ms-3" for="attendance_${student.student_id}">
                            <div>
                                <strong class="d-block">${student.name || 'Unknown Student'}</strong>
                                <small class="text-muted">ID: ${student.student_id} | Course: ${student.course || 'N/A'}</small>
                            </div>
                        </label>
                    </div>
                    <span class="badge ${badgeClass} present-badge">${badgeText}</span>
                </div>
            `;
            container.appendChild(studentDiv);
        });

        // Add event listeners for checkboxes
        const checkboxes = document.querySelectorAll('.attendance-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const badge = this.closest('.d-flex').querySelector('.present-badge');
                if (this.checked) {
                    badge.textContent = 'Present';
                    badge.className = 'badge bg-success present-badge';
                } else {
                    badge.textContent = 'Absent';
                    badge.className = 'badge bg-danger present-badge';
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading students:', error);
        container.innerHTML = '<p class="text-danger text-center p-3">Failed to load students: ' + error.message + '</p>';
    }
}

// Load existing attendance for editing
async function loadExistingAttendance(attendanceId) {
    try {
        console.log(`Loading existing attendance for editing: ${attendanceId}`);
        
        const response = await fetch(`http://localhost:5000/api/attendance/${attendanceId}`);
        const result = await response.json();
        
        if (result.success) {
            const attendance = result.attendance;
            const classSelect = document.querySelector('#attendanceForm select[name="class"]');
            const dateInput = document.querySelector('#attendanceForm input[name="date"]');
            
            // Set the form values
            if (classSelect) classSelect.value = attendance.class;
            if (dateInput) dateInput.value = attendance.date;
            
            // Reload students with existing attendance data
            await loadClassStudents(attendance.class);
            
            showSuccess('Loaded existing attendance for editing');
        } else {
            showError('Failed to load attendance data: ' + result.message);
        }
    } catch (error) {
        console.error('Error loading existing attendance:', error);
        showError('Failed to load attendance data: ' + error.message);
    }
}

// FIXED: Save attendance function
async function saveAttendance() {
    const form = document.getElementById('attendanceForm');
    if (!form) {
        alert('Attendance form not found');
        return;
    }
    
    const formData = new FormData(form);
    const className = formData.get('class');
    const date = formData.get('date');
    
    if (!className) {
        alert('Please select a class');
        return;
    }
    
    if (!date) {
        alert('Please select a date');
        return;
    }
    
    const attendanceStatus = {};
    const checkboxes = document.querySelectorAll('.attendance-checkbox');
    
    if (checkboxes.length === 0) {
        alert('No students found for this class');
        return;
    }
    
    checkboxes.forEach(checkbox => {
        attendanceStatus[checkbox.dataset.studentId] = checkbox.checked ? 'present' : 'absent';
    });
    
    console.log('Saving attendance:', { class: className, date: date, attendance: attendanceStatus });
    
    try {
        const response = await fetch('http://localhost:5000/api/mark-attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                class: className,
                date: date,
                attendance: attendanceStatus
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadDashboardData();
            const modal = bootstrap.Modal.getInstance(document.getElementById('attendanceModal'));
            if (modal) modal.hide();
            showSuccess('Attendance marked successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('Failed to save attendance. Please try again. Error: ' + error.message);
    }
}

// View individual class attendance
async function viewClassAttendance(className) {
    try {
        const response = await fetch(`http://localhost:5000/api/attendance/class/${className}`);
        const result = await response.json();
        
        if (result.success) {
            // Create a modal to show class attendance
            const modalHtml = `
                <div class="modal fade" id="classAttendanceModal" tabindex="-1">
                    <div class="modal-dialog modal-xl">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Attendance for ${className}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Present</th>
                                                <th>Absent</th>
                                                <th>Percentage</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${result.attendance.map(record => `
                                                <tr>
                                                    <td>${formatDate(record.date)}</td>
                                                    <td><span class="badge bg-success">${record.present_count}</span></td>
                                                    <td><span class="badge bg-danger">${record.absent_count}</span></td>
                                                    <td>
                                                        <div class="d-flex align-items-center">
                                                            <div class="progress flex-grow-1 me-2" style="height: 8px;">
                                                                <div class="progress-bar" style="width: ${record.percentage}%"></div>
                                                            </div>
                                                            <span>${record.percentage}%</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <button class="btn btn-info btn-sm" onclick="viewAttendanceDetails(${record.id})">
                                                            <i class="fas fa-eye"></i> Details
                                                        </button>
                                                        <button class="btn btn-danger btn-sm" onclick="deleteAttendance(${record.id})">
                                                            <i class="fas fa-trash"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal if any
            const existingModal = document.getElementById('classAttendanceModal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('classAttendanceModal'));
            modal.show();
        } else {
            showError('Failed to load class attendance: ' + result.message);
        }
    } catch (error) {
        console.error('Error viewing class attendance:', error);
        showError('Failed to load class attendance: ' + error.message);
    }
}

// View detailed attendance
async function viewAttendanceDetails(attendanceId) {
    try {
        const response = await fetch(`http://localhost:5000/api/attendance/${attendanceId}`);
        const result = await response.json();
        
        if (result.success) {
            const attendance = result.attendance;
            let details = `Attendance Details for ${attendance.date} - ${attendance.class}\n\n`;
            details += `Present: ${attendance.present_count} | Absent: ${attendance.absent_count} | Percentage: ${attendance.percentage}%\n\n`;
            details += 'Student-wise Attendance:\n';
            
            if (attendance.attendance_data) {
                Object.entries(attendance.attendance_data).forEach(([studentId, status]) => {
                    // Find student name
                    const student = studentsData.find(s => s.student_id === studentId);
                    const studentName = student ? student.name : studentId;
                    const statusIcon = status === 'present' ? '✅' : '❌';
                    details += `\n${statusIcon} ${studentName}: ${status}`;
                });
            }
            
            alert(details);
        } else {
            alert('Error loading attendance details: ' + result.message);
        }
    } catch (error) {
        console.error('Error viewing attendance details:', error);
        alert('Failed to load attendance details. Please try again. Error: ' + error.message);
    }
}

// Update attendance table to show class-wise actions
function updateAttendanceTable() {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (attendanceData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-clipboard-list"></i>
                        <p>No attendance records found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Group attendance by class
    const attendanceByClass = {};
    attendanceData.forEach(record => {
        if (!attendanceByClass[record.class]) {
            attendanceByClass[record.class] = [];
        }
        attendanceByClass[record.class].push(record);
    });
    
    // Display classes with their latest attendance
    Object.entries(attendanceByClass).forEach(([className, records]) => {
        const latestRecord = records[0]; // Most recent record
        const totalRecords = records.length;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${className || 'Unknown Class'}</strong>
                <br><small class="text-muted">${totalRecords} record(s)</small>
            </td>
            <td>${latestRecord.present_count || 0}</td>
            <td>${latestRecord.absent_count || 0}</td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="progress flex-grow-1 me-2" style="height: 8px;">
                        <div class="progress-bar ${(latestRecord.percentage || 0) >= 80 ? 'bg-success' : (latestRecord.percentage || 0) >= 60 ? 'bg-warning' : 'bg-danger'}" 
                             style="width: ${latestRecord.percentage || 0}%"></div>
                    </div>
                    <span>${latestRecord.percentage || 0}%</span>
                </div>
            </td>
            <td>${formatDate(latestRecord.date)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-action" onclick="viewClassAttendance('${className}')" title="View Class Attendance">
                        <i class="fas fa-list"></i>
                    </button>
                    <button class="btn btn-primary btn-action" onclick="markClassAttendance('${className}')" title="Mark Attendance">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Mark attendance for specific class
function markClassAttendance(className) {
    const modalElement = document.getElementById('attendanceModal');
    if (!modalElement) {
        console.error('Attendance modal not found');
        return;
    }
    
    const modal = new bootstrap.Modal(modalElement);
    const classSelect = document.querySelector('#attendanceForm select[name="class"]');
    const dateInput = document.querySelector('#attendanceForm input[name="date"]');
    
    // Set the class and current date
    if (classSelect) classSelect.value = className;
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    // Load students for the class
    loadClassStudents(className);
    
    // Show modal
    modal.show();
}

// Update students table
function updateStudentsTable() {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (studentsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-user-graduate"></i>
                        <p>No students found</p>
                        <button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#studentModal">
                            <i class="fas fa-plus me-1"></i> Add First Student
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    studentsData.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.student_id || 'N/A'}</td>
            <td>${student.name || 'Unknown'}</td>
            <td>${student.course || 'No Course'}</td>
            <td>${formatDate(student.join_date)}</td>
            <td>${student.phone || 'N/A'}</td>
            <td>
                <span class="status-badge ${getFeeStatusClass(student.fee_status)}">
                    ${student.fee_status || 'Unknown'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-action" onclick="viewStudent('${student.student_id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-warning btn-action" onclick="editStudent('${student.student_id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-action" onclick="deleteStudent('${student.student_id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Get fee status class
function getFeeStatusClass(status) {
    if (!status) return 'bg-secondary';
    
    switch (status.toLowerCase()) {
        case 'paid': return 'bg-success';
        case 'partial': return 'bg-warning';
        case 'pending': return 'bg-danger';
        default: return 'bg-secondary';
    }
}

// Update teachers table
function updateTeachersTable() {
    const tbody = document.getElementById('teachersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (teachersData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-chalkboard-teacher"></i>
                        <p>No teachers found</p>
                        <button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#teacherModal">
                            <i class="fas fa-plus me-1"></i> Add First Teacher
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    teachersData.forEach(teacher => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${teacher.teacher_id || 'N/A'}</td>
            <td>${teacher.name || 'Unknown'}</td>
            <td>${teacher.subject || 'No Subject'}</td>
            <td>${formatDate(teacher.joining_date)}</td>
            <td>${teacher.phone || 'N/A'}</td>
            <td>₹${(teacher.salary || 0).toLocaleString()}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-action" onclick="viewTeacher('${teacher.teacher_id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-warning btn-action" onclick="editTeacher('${teacher.teacher_id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-action" onclick="deleteTeacher('${teacher.teacher_id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update courses table
function updateCoursesTable() {
    const tbody = document.getElementById('coursesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (coursesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-book"></i>
                        <p>No courses found</p>
                        <button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#courseModal">
                            <i class="fas fa-plus me-1"></i> Add First Course
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    coursesData.forEach(course => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${course.course_code || 'N/A'}</td>
            <td>${course.course_name || 'Unnamed Course'}</td>
            <td>${course.duration || 0} months</td>
            <td>₹${(course.fee_amount || 0).toLocaleString()}</td>
            <td><span class="badge bg-info">${course.category || 'general'}</span></td>
            <td>${course.student_count || 0}</td>
            <td>
                <span class="status-badge ${course.is_active ? 'bg-success' : 'bg-secondary'}">
                    ${course.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-action" onclick="viewCourse('${course.course_code}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-warning btn-action" onclick="editCourse('${course.course_code}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-action" onclick="deleteCourse('${course.course_code}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update fees table
function updateFeesTable() {
    const tbody = document.getElementById('feesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (feesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-money-bill-wave"></i>
                        <p>No fee records found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    feesData.forEach(fee => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${fee.receipt_no || 'N/A'}</td>
            <td>${fee.student_name || 'Unknown'}</td>
            <td>${fee.course || 'No Course'}</td>
            <td>₹${(fee.amount || 0).toLocaleString()}</td>
            <td>${formatDate(fee.payment_date)}</td>
            <td>${fee.payment_mode || 'Unknown'}</td>
            <td><span class="status-badge bg-success">${fee.status || 'Unknown'}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-action" onclick="viewReceipt('${fee.receipt_no}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-danger btn-action" onclick="deleteFeeRecord('${fee.receipt_no}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update marks table
function updateMarksTable() {
    const tbody = document.getElementById('marksTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (marksData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-chart-line"></i>
                        <p>No marks records found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    marksData.forEach(mark => {
        const percentage = ((mark.marks_obtained || 0) / (mark.total_marks || 100)) * 100;
        let grade = 'F';
        
        if (percentage >= 90) grade = 'A+';
        else if (percentage >= 80) grade = 'A';
        else if (percentage >= 70) grade = 'B';
        else if (percentage >= 60) grade = 'C';
        else if (percentage >= 50) grade = 'D';
        else if (percentage >= 40) grade = 'E';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${mark.exam_type || 'Unknown'}</td>
            <td>${mark.student_name || 'Unknown'}</td>
            <td>${mark.course || 'No Course'}</td>
            <td>${mark.subject || 'No Subject'}</td>
            <td>${mark.marks_obtained || 0}/${mark.total_marks || 100}</td>
            <td>${percentage.toFixed(2)}%</td>
            <td>
                <span class="status-badge ${getGradeClass(grade)}">${grade}</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-info btn-action" onclick="viewMarks('${mark.id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-warning btn-action" onclick="editMarks('${mark.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-action" onclick="deleteMarks('${mark.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Get grade class
function getGradeClass(grade) {
    switch (grade) {
        case 'A+': case 'A': return 'bg-success';
        case 'B': case 'C': return 'bg-info';
        case 'D': case 'E': return 'bg-warning';
        case 'F': return 'bg-danger';
        default: return 'bg-secondary';
    }
}

// Reset modal to add mode
function resetModalToAddMode(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    const title = modal.querySelector('.modal-title');
    const saveBtn = modal.querySelector('.btn-primary');
    
    if (!title || !saveBtn) return;
    
    switch (modalId) {
        case 'studentModal':
            title.textContent = 'New Student Admission';
            saveBtn.textContent = 'Save Student';
            saveBtn.onclick = saveStudent;
            break;
        case 'teacherModal':
            title.textContent = 'Add New Teacher';
            saveBtn.textContent = 'Save Teacher';
            saveBtn.onclick = saveTeacher;
            break;
        case 'courseModal':
            title.textContent = 'Add New Course';
            saveBtn.textContent = 'Save Course';
            saveBtn.onclick = saveCourse;
            break;
        case 'marksModal':
            title.textContent = 'Enter Student Marks';
            saveBtn.textContent = 'Save Marks';
            saveBtn.onclick = saveMarks;
            break;
        case 'notificationModal':
            title.textContent = 'Send Notification';
            saveBtn.textContent = 'Send Notification';
            saveBtn.onclick = sendNotification;
            break;
    }
    
    currentEditId = null;
}

// Save student function
async function saveStudent() {
    const form = document.getElementById('studentForm');
    if (!form) {
        alert('Student form not found');
        return;
    }
    
    const formData = new FormData(form);
    
    const requiredFields = ['fullName', 'parentName', 'phone', 'course', 'fee'];
    const missingFields = requiredFields.filter(field => !formData.get(field));
    
    if (missingFields.length > 0) {
        alert('Please fill all required fields: ' + missingFields.join(', '));
        return;
    }
    
    try {
        const button = document.getElementById('studentSaveBtn');
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="loading-spinner"></span> Saving...';
        button.disabled = true;
        
        const url = currentEditId ? 
            `http://localhost:5000/api/update-student/${currentEditId}` :
            'http://localhost:5000/api/add-student';
        
        const method = currentEditId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fullName: formData.get('fullName'),
                parentName: formData.get('parentName'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                course: formData.get('course'),
                fee: formData.get('fee'),
                address: formData.get('address')
            })
        });
        
        const result = await response.json();
        
        button.innerHTML = originalText;
        button.disabled = false;
        
        if (result.success) {
            await loadDashboardData();
            const modal = bootstrap.Modal.getInstance(document.getElementById('studentModal'));
            if (modal) modal.hide();
            showSuccess(currentEditId ? 'Student updated successfully!' : 'Student added successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error saving student:', error);
        const button = document.getElementById('studentSaveBtn');
        if (button) {
            button.innerHTML = 'Save Student';
            button.disabled = false;
        }
        alert('Failed to save student. Please try again. Error: ' + error.message);
    }
}

// Save teacher function
async function saveTeacher() {
    const form = document.getElementById('teacherForm');
    if (!form) {
        alert('Teacher form not found');
        return;
    }
    
    const formData = new FormData(form);
    
    const requiredFields = ['fullName', 'subject', 'phone', 'salary', 'joiningDate'];
    const missingFields = requiredFields.filter(field => !formData.get(field));
    
    if (missingFields.length > 0) {
        alert('Please fill all required fields: ' + missingFields.join(', '));
        return;
    }
    
    try {
        const button = document.getElementById('teacherSaveBtn');
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="loading-spinner"></span> Saving...';
        button.disabled = true;
        
        const url = currentEditId ? 
            `http://localhost:5000/api/update-teacher/${currentEditId}` :
            'http://localhost:5000/api/add-teacher';
        
        const method = currentEditId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fullName: formData.get('fullName'),
                subject: formData.get('subject'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                salary: formData.get('salary'),
                joiningDate: formData.get('joiningDate'),
                address: formData.get('address')
            })
        });
        
        const result = await response.json();
        
        button.innerHTML = originalText;
        button.disabled = false;
        
        if (result.success) {
            await loadDashboardData();
            const modal = bootstrap.Modal.getInstance(document.getElementById('teacherModal'));
            if (modal) modal.hide();
            showSuccess(currentEditId ? 'Teacher updated successfully!' : 'Teacher added successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error saving teacher:', error);
        const button = document.getElementById('teacherSaveBtn');
        if (button) {
            button.innerHTML = 'Save Teacher';
            button.disabled = false;
        }
        alert('Failed to save teacher. Please try again. Error: ' + error.message);
    }
}

// Save course function
async function saveCourse() {
    const form = document.getElementById('courseForm');
    if (!form) {
        alert('Course form not found');
        return;
    }
    
    const formData = new FormData(form);
    
    const requiredFields = ['courseName', 'courseCode', 'duration', 'feeAmount'];
    const missingFields = requiredFields.filter(field => !formData.get(field));
    
    if (missingFields.length > 0) {
        alert('Please fill all required fields: ' + missingFields.join(', '));
        return;
    }
    
    try {
        const button = document.getElementById('courseSaveBtn');
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="loading-spinner"></span> Saving...';
        button.disabled = true;
        
        const url = currentEditId ? 
            `http://localhost:5000/api/update-course/${currentEditId}` :
            'http://localhost:5000/api/add-course';
        
        const method = currentEditId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                courseName: formData.get('courseName'),
                courseCode: formData.get('courseCode'),
                duration: formData.get('duration'),
                feeAmount: formData.get('feeAmount'),
                description: formData.get('description'),
                category: formData.get('category'),
                isActive: formData.get('isActive') === 'on'
            })
        });
        
        const result = await response.json();
        
        button.innerHTML = originalText;
        button.disabled = false;
        
        if (result.success) {
            await loadDashboardData();
            const modal = bootstrap.Modal.getInstance(document.getElementById('courseModal'));
            if (modal) modal.hide();
            showSuccess(currentEditId ? 'Course updated successfully!' : 'Course added successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error saving course:', error);
        const button = document.getElementById('courseSaveBtn');
        if (button) {
            button.innerHTML = 'Save Course';
            button.disabled = false;
        }
        alert('Failed to save course. Please try again. Error: ' + error.message);
    }
}

// Record payment function
async function recordPayment() {
    const form = document.getElementById('feeForm');
    if (!form) {
        alert('Fee form not found');
        return;
    }
    
    const formData = new FormData(form);
    
    const requiredFields = ['studentId', 'payingNow', 'paymentDate', 'paymentMode'];
    const missingFields = requiredFields.filter(field => !formData.get(field));
    
    if (missingFields.length > 0) {
        alert('Please fill all required fields: ' + missingFields.join(', '));
        return;
    }
    
    const payingAmount = parseFloat(formData.get('payingNow'));
    const dueAmount = parseFloat(formData.get('dueAmount'));
    
    if (payingAmount > dueAmount) {
        alert('Paying amount cannot be greater than due amount');
        return;
    }
    
    try {
        const response = await fetch('http://localhost:5000/api/record-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                studentId: formData.get('studentId'),
                amount: payingAmount,
                paymentDate: formData.get('paymentDate'),
                paymentMode: formData.get('paymentMode')
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadDashboardData();
            const modal = bootstrap.Modal.getInstance(document.getElementById('feeModal'));
            if (modal) modal.hide();
            showSuccess('Payment recorded successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error recording payment:', error);
        alert('Failed to record payment. Please try again. Error: ' + error.message);
    }
}

// Save marks function
async function saveMarks() {
    const form = document.getElementById('marksForm');
    if (!form) {
        alert('Marks form not found');
        return;
    }
    
    const formData = new FormData(form);
    
    const requiredFields = ['exam', 'studentId', 'subject', 'marks', 'examDate'];
    const missingFields = requiredFields.filter(field => !formData.get(field));
    
    if (missingFields.length > 0) {
        alert('Please fill all required fields: ' + missingFields.join(', '));
        return;
    }
    
    const marks = parseFloat(formData.get('marks'));
    if (marks < 0 || marks > 100) {
        alert('Marks must be between 0 and 100');
        return;
    }
    
    try {
        const button = document.getElementById('marksSaveBtn');
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="loading-spinner"></span> Saving...';
        button.disabled = true;
        
        const url = currentEditId ? 
            `http://localhost:5000/api/update-marks/${currentEditId}` :
            'http://localhost:5000/api/add-marks';
        
        const method = currentEditId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                exam: formData.get('exam'),
                studentId: formData.get('studentId'),
                subject: formData.get('subject'),
                marks: marks,
                totalMarks: formData.get('totalMarks'),
                examDate: formData.get('examDate')
            })
        });
        
        const result = await response.json();
        
        button.innerHTML = originalText;
        button.disabled = false;
        
        if (result.success) {
            await loadDashboardData();
            const modal = bootstrap.Modal.getInstance(document.getElementById('marksModal'));
            if (modal) modal.hide();
            showSuccess(currentEditId ? 'Marks updated successfully!' : 'Marks saved successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error saving marks:', error);
        const button = document.getElementById('marksSaveBtn');
        if (button) {
            button.innerHTML = 'Save Marks';
            button.disabled = false;
        }
        alert('Failed to save marks. Please try again. Error: ' + error.message);
    }
}

// Send notification function
async function sendNotification() {
    const form = document.getElementById('notificationForm');
    if (!form) {
        alert('Notification form not found');
        return;
    }
    
    const formData = new FormData(form);
    
    const title = formData.get('title');
    const message = formData.get('message');
    const audience = formData.get('audience');
    
    if (!title || !message || !audience) {
        alert('Please fill all required fields');
        return;
    }
    
    try {
        const button = document.querySelector('#notificationModal .btn-primary');
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="loading-spinner"></span> Sending...';
        button.disabled = true;
        
        const url = currentEditId ? 
            `http://localhost:5000/api/update-notification/${currentEditId}` :
            'http://localhost:5000/api/send-notification';
        
        const method = currentEditId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                message: message,
                audience: audience,
                priority: formData.get('priority') || 'medium'
            })
        });
        
        const result = await response.json();
        
        button.innerHTML = originalText;
        button.disabled = false;
        
        if (result.success) {
            await loadNotifications();
            const modal = bootstrap.Modal.getInstance(document.getElementById('notificationModal'));
            if (modal) modal.hide();
            showSuccess(currentEditId ? 'Notification updated successfully!' : 'Notification sent successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error sending notification:', error);
        const button = document.querySelector('#notificationModal .btn-primary');
        if (button) {
            button.innerHTML = 'Send Notification';
            button.disabled = false;
        }
        alert('Failed to send notification. Please try again. Error: ' + error.message);
    }
}

// Generate report function
async function generateReport() {
    const form = document.getElementById('reportForm');
    if (!form) {
        alert('Report form not found');
        return;
    }
    
    const formData = new FormData(form);
    
    if (!formData.get('reportType') || !formData.get('format')) {
        alert('Please fill all required fields');
        return;
    }
    
    try {
        const button = document.querySelector('#reportModal .btn-primary');
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="loading-spinner"></span> Generating...';
        button.disabled = true;
        
        const response = await fetch('http://localhost:5000/api/generate-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reportType: formData.get('reportType'),
                startDate: formData.get('startDate'),
                endDate: formData.get('endDate'),
                format: formData.get('format')
            })
        });
        
        const result = await response.json();
        
        button.innerHTML = originalText;
        button.disabled = false;
        
        if (result.success) {
            if (result.data) {
                // Create and download file
                const blob = new Blob([result.data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.filename || `report_${new Date().getTime()}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('reportModal'));
            if (modal) modal.hide();
            showSuccess('Report generated successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error generating report:', error);
        const button = document.querySelector('#reportModal .btn-primary');
        if (button) {
            button.innerHTML = 'Generate Report';
            button.disabled = false;
        }
        alert('Failed to generate report. Please try again. Error: ' + error.message);
    }
}

// Save settings function
async function saveSettings() {
    const form = document.getElementById('settingsForm');
    if (!form) {
        alert('Settings form not found');
        return;
    }
    
    const formData = new FormData(form);
    
    try {
        const response = await fetch('http://localhost:5000/api/update-settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instituteName: formData.get('instituteName'),
                address: formData.get('address'),
                contactNumber: formData.get('contactNumber'),
                email: formData.get('email'),
                website: formData.get('website')
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
            if (modal) modal.hide();
            showSuccess('Settings saved successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Failed to save settings. Please try again. Error: ' + error.message);
    }
}

// Sync with Supabase
async function syncWithSupabase() {
    try {
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
            syncStatus.className = 'sync-status bg-info text-white';
            syncStatus.innerHTML = '<i class="fas fa-sync-alt fa-spin me-2"></i> Syncing with Supabase...';
            syncStatus.style.display = 'block';
        }
        
        const response = await fetch('http://localhost:5000/api/sync-supabase');
        const result = await response.json();
        
        if (result.success) {
            if (syncStatus) {
                syncStatus.className = 'sync-status bg-success text-white';
                syncStatus.innerHTML = '<i class="fas fa-check-circle me-2"></i> Data synced with Supabase';
            }
            
            await loadDashboardData();
        } else {
            throw new Error(result.message);
        }
        
        setTimeout(() => {
            if (syncStatus) {
                syncStatus.style.display = 'none';
            }
        }, 3000);
        
    } catch (error) {
        console.error('Error syncing with Supabase:', error);
        
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
            syncStatus.className = 'sync-status bg-danger text-white';
            syncStatus.innerHTML = '<i class="fas fa-exclamation-circle me-2"></i> Sync failed';
            syncStatus.style.display = 'block';
        }
        
        setTimeout(() => {
            if (syncStatus) {
                syncStatus.style.display = 'none';
            }
        }, 3000);
        
        alert('Failed to sync with Supabase. Please check your connection and try again. Error: ' + error.message);
    }
}

// Export data function
async function exportData(type) {
    try {
        const response = await fetch(`http://localhost:5000/api/export-data?type=${type}`);
        const result = await response.json();
        
        if (result.success) {
            const blob = new Blob([result.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showSuccess(`${type} data exported successfully!`);
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data. Please try again. Error: ' + error.message);
    }
}

// Logout function
function logout() {
    if (confirm("Are you sure you want to log out?")) {
        alert("You have been logged out!");
        window.location.href = "login.html";
    }
}

// Edit Student Function
async function editStudent(studentId) {
    const student = studentsData.find(s => s.student_id === studentId);
    if (!student) {
        alert('Student not found!');
        return;
    }

    const form = document.getElementById('studentForm');
    if (!form) {
        alert('Student form not found');
        return;
    }

    form.querySelector('input[name="fullName"]').value = student.name || '';
    form.querySelector('input[name="parentName"]').value = student.parent_name || '';
    form.querySelector('input[name="phone"]').value = student.phone || '';
    form.querySelector('input[name="email"]').value = student.email || '';
    form.querySelector('select[name="course"]').value = student.course || '';
    form.querySelector('input[name="fee"]').value = student.fee_amount || '';
    form.querySelector('textarea[name="address"]').value = student.address || '';

    const modal = document.getElementById('studentModal');
    const title = modal.querySelector('.modal-title');
    const saveBtn = modal.querySelector('.btn-primary');
    
    if (title) title.textContent = 'Edit Student';
    if (saveBtn) {
        saveBtn.textContent = 'Update Student';
        saveBtn.onclick = function() { saveStudent(); };
    }

    currentEditId = studentId;
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Edit Teacher Function
async function editTeacher(teacherId) {
    const teacher = teachersData.find(t => t.teacher_id === teacherId);
    if (!teacher) {
        alert('Teacher not found!');
        return;
    }

    const form = document.getElementById('teacherForm');
    if (!form) {
        alert('Teacher form not found');
        return;
    }

    form.querySelector('input[name="fullName"]').value = teacher.name || '';
    form.querySelector('input[name="subject"]').value = teacher.subject || '';
    form.querySelector('input[name="phone"]').value = teacher.phone || '';
    form.querySelector('input[name="email"]').value = teacher.email || '';
    form.querySelector('input[name="salary"]').value = teacher.salary || '';
    form.querySelector('input[name="joiningDate"]').value = teacher.joining_date || '';
    form.querySelector('textarea[name="address"]').value = teacher.address || '';

    const modal = document.getElementById('teacherModal');
    const title = modal.querySelector('.modal-title');
    const saveBtn = modal.querySelector('.btn-primary');
    
    if (title) title.textContent = 'Edit Teacher';
    if (saveBtn) {
        saveBtn.textContent = 'Update Teacher';
        saveBtn.onclick = function() { saveTeacher(); };
    }

    currentEditId = teacherId;
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Edit Course Function
async function editCourse(courseCode) {
    const course = coursesData.find(c => c.course_code === courseCode);
    if (!course) {
        alert('Course not found!');
        return;
    }

    const form = document.getElementById('courseForm');
    if (!form) {
        alert('Course form not found');
        return;
    }

    form.querySelector('input[name="courseName"]').value = course.course_name || '';
    form.querySelector('input[name="courseCode"]').value = course.course_code || '';
    form.querySelector('input[name="duration"]').value = course.duration || '';
    form.querySelector('input[name="feeAmount"]').value = course.fee_amount || '';
    form.querySelector('textarea[name="description"]').value = course.description || '';
    form.querySelector('select[name="category"]').value = course.category || 'computer';
    form.querySelector('input[name="isActive"]').checked = course.is_active || false;

    const modal = document.getElementById('courseModal');
    const title = modal.querySelector('.modal-title');
    const saveBtn = modal.querySelector('.btn-primary');
    
    if (title) title.textContent = 'Edit Course';
    if (saveBtn) {
        saveBtn.textContent = 'Update Course';
        saveBtn.onclick = function() { saveCourse(); };
    }

    currentEditId = courseCode;
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Edit Marks Function
async function editMarks(marksId) {
    const mark = marksData.find(m => m.id == marksId);
    if (!mark) {
        alert('Marks record not found!');
        return;
    }

    const form = document.getElementById('marksForm');
    if (!form) {
        alert('Marks form not found');
        return;
    }

    form.querySelector('select[name="exam"]').value = mark.exam_type || '';
    form.querySelector('select[name="studentId"]').value = mark.student_id || '';
    form.querySelector('input[name="subject"]').value = mark.subject || '';
    form.querySelector('input[name="marks"]').value = mark.marks_obtained || '';
    form.querySelector('input[name="totalMarks"]').value = mark.total_marks || '';
    form.querySelector('input[name="examDate"]').value = mark.exam_date || '';

    const modal = document.getElementById('marksModal');
    const title = modal.querySelector('.modal-title');
    const saveBtn = modal.querySelector('.btn-primary');
    
    if (title) title.textContent = 'Edit Marks';
    if (saveBtn) {
        saveBtn.textContent = 'Update Marks';
        saveBtn.onclick = function() { saveMarks(); };
    }

    currentEditId = marksId;
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Edit Notification Function
async function editNotification(notificationId) {
    const notification = notificationsData.find(n => n.id == notificationId);
    if (!notification) {
        alert('Notification not found!');
        return;
    }

    const form = document.getElementById('notificationForm');
    if (!form) {
        alert('Notification form not found');
        return;
    }

    form.querySelector('input[name="title"]').value = notification.title || '';
    form.querySelector('textarea[name="message"]').value = notification.message || '';
    form.querySelector('select[name="audience"]').value = notification.audience || 'all';
    form.querySelector('select[name="priority"]').value = notification.priority || 'medium';

    const modal = document.getElementById('notificationModal');
    const title = modal.querySelector('.modal-title');
    const saveBtn = modal.querySelector('.btn-primary');
    
    if (title) title.textContent = 'Edit Notification';
    if (saveBtn) {
        saveBtn.textContent = 'Update Notification';
        saveBtn.onclick = function() { sendNotification(); };
    }

    currentEditId = notificationId;
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}
// Delete functions
async function deleteStudent(studentId) {
    const student = studentsData.find(s => s.student_id === studentId);
    if (!student) {
        alert('Student not found!');
        return;
    }

    let message = `Are you sure you want to delete student ${student.name} (${student.student_id})?\n\n`;
    
    // Check if student has fee records
    const hasFeeRecords = feesData.some(f => f.student_id === studentId);
    const hasMarksRecords = marksData.some(m => m.student_id === studentId);
    
    if (hasFeeRecords || hasMarksRecords) {
        message += "⚠️ Warning: This student has associated records:\n";
        if (hasFeeRecords) message += "• Fee payment records\n";
        if (hasMarksRecords) message += "• Exam marks records\n";
        message += "\nDeleting will remove all associated records. This action cannot be undone!";
        
        if (!confirm(message)) return;
        
        // Use force delete
        try {
            const response = await fetch(`http://localhost:5000/api/delete-student-force/${studentId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                await loadDashboardData();
                showSuccess('Student and all related records deleted successfully!');
            } else {
                alert('Error: ' + (result.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error force deleting student:', error);
            alert('Failed to delete student. Please try again. Error: ' + error.message);
        }
    } else {
        // Regular delete for students without records
        if (!confirm(message + "This action cannot be undone.")) return;
        
        try {
            const response = await fetch(`http://localhost:5000/api/delete-student/${studentId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                await loadDashboardData();
                showSuccess('Student deleted successfully!');
            } else {
                alert('Error: ' + (result.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting student:', error);
            alert('Failed to delete student. Please try again. Error: ' + error.message);
        }
    }
}
// View functions
function viewStudent(studentId) {
    const student = studentsData.find(s => s.student_id === studentId);
    if (student) {
        alert(`Student Details:\n\nName: ${student.name}\nParent: ${student.parent_name}\nCourse: ${student.course}\nPhone: ${student.phone}\nEmail: ${student.email || 'N/A'}\nFee Status: ${student.fee_status}\nPaid: ₹${student.paid_amount || 0}\nDue: ₹${student.due_amount || 0}\nAddress: ${student.address || 'N/A'}`);
    }
}

function viewTeacher(teacherId) {
    const teacher = teachersData.find(t => t.teacher_id === teacherId);
    if (teacher) {
        alert(`Teacher Details:\n\nName: ${teacher.name}\nSubject: ${teacher.subject}\nPhone: ${teacher.phone}\nEmail: ${teacher.email || 'N/A'}\nSalary: ₹${teacher.salary}\nJoining Date: ${formatDate(teacher.joining_date)}\nAddress: ${teacher.address || 'N/A'}`);
    }
}

function viewCourse(courseCode) {
    const course = coursesData.find(c => c.course_code === courseCode);
    if (course) {
        alert(`Course Details:\n\nCode: ${course.course_code}\nName: ${course.course_name}\nDuration: ${course.duration} months\nFee: ₹${course.fee_amount}\nCategory: ${course.category}\nStatus: ${course.is_active ? 'Active' : 'Inactive'}\nStudents: ${course.student_count || 0}\nDescription: ${course.description || 'N/A'}`);
    }
}

function viewReceipt(receiptNo) {
    const fee = feesData.find(f => f.receipt_no === receiptNo);
    if (fee) {
        alert(`Receipt Details:\n\nReceipt No: ${fee.receipt_no}\nStudent: ${fee.student_name}\nCourse: ${fee.course}\nAmount: ₹${fee.amount}\nPayment Date: ${formatDate(fee.payment_date)}\nPayment Mode: ${fee.payment_mode}\nStatus: ${fee.status}`);
    }
}

function viewMarks(marksId) {
    const mark = marksData.find(m => m.id == marksId);
    if (mark) {
        const percentage = ((mark.marks_obtained || 0) / (mark.total_marks || 100)) * 100;
        alert(`Marks Details:\n\nStudent: ${mark.student_name}\nExam: ${mark.exam_type}\nSubject: ${mark.subject}\nMarks: ${mark.marks_obtained}/${mark.total_marks}\nPercentage: ${percentage.toFixed(2)}%\nGrade: ${mark.grade}\nExam Date: ${formatDate(mark.exam_date)}`);
    }
}

// Delete functions
async function deleteStudent(studentId) {
    if (!confirm("Are you sure you want to delete this student? This action cannot be undone.")) return;
    
    try {
        const response = await fetch(`http://localhost:5000/api/delete-student/${studentId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadDashboardData();
            showSuccess('Student deleted successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        alert('Failed to delete student. Please try again. Error: ' + error.message);
    }
}

async function deleteTeacher(teacherId) {
    if (!confirm("Are you sure you want to delete this teacher? This action cannot be undone.")) return;
    
    try {
        const response = await fetch(`http://localhost:5000/api/delete-teacher/${teacherId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadDashboardData();
            showSuccess('Teacher deleted successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting teacher:', error);
        alert('Failed to delete teacher. Please try again. Error: ' + error.message);
    }
}

async function deleteCourse(courseCode) {
    if (!confirm("Are you sure you want to delete this course? This action cannot be undone.")) return;
    
    try {
        const response = await fetch(`http://localhost:5000/api/delete-course/${courseCode}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadDashboardData();
            showSuccess('Course deleted successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting course:', error);
        alert('Failed to delete course. Please try again. Error: ' + error.message);
    }
}

async function deleteFeeRecord(receiptNo) {
    if (!confirm("Are you sure you want to delete this fee record? This action cannot be undone.")) return;
    
    try {
        const response = await fetch(`http://localhost:5000/api/delete-fee/${receiptNo}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadDashboardData();
            showSuccess('Fee record deleted successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting fee record:', error);
        alert('Failed to delete fee record. Please try again. Error: ' + error.message);
    }
}

async function deleteAttendance(attendanceId) {
    if (!confirm("Are you sure you want to delete this attendance record? This action cannot be undone.")) return;
    
    try {
        const response = await fetch(`http://localhost:5000/api/delete-attendance/${attendanceId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadDashboardData();
            showSuccess('Attendance record deleted successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting attendance record:', error);
        alert('Failed to delete attendance record. Please try again. Error: ' + error.message);
    }
}

async function deleteMarks(marksId) {
    if (!confirm("Are you sure you want to delete this marks record? This action cannot be undone.")) return;
    
    try {
        const response = await fetch(`http://localhost:5000/api/delete-marks/${marksId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadDashboardData();
            showSuccess('Marks record deleted successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting marks record:', error);
        alert('Failed to delete marks record. Please try again. Error: ' + error.message);
    }
}

async function deleteNotification(notificationId) {
    if (!confirm("Are you sure you want to delete this notification?")) return;
    
    try {
        const response = await fetch(`http://localhost:5000/api/delete-notification/${notificationId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadNotifications();
            showSuccess('Notification deleted successfully!');
        } else {
            alert('Error: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting notification:', error);
        alert('Failed to delete notification. Please try again. Error: ' + error.message);
    }
}

// Mark all notifications as read
function markAllNotificationsRead() {
    const notifications = document.querySelectorAll('.notification-item');
    notifications.forEach(notification => {
        notification.style.opacity = '0.7';
    });
    const badge = document.getElementById('notificationCount');
    if (badge) badge.textContent = '0';
    showSuccess('All notifications marked as read!');
}

// Mobile menu functionality
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('mobile-open');
    }
}

// Debug function to check courses
function debugCourses() {
    console.log('=== COURSES DEBUG INFO ===');
    console.log('Courses data array:', coursesData);
    console.log('Courses data length:', coursesData.length);
    
    const attendanceSelect = document.querySelector('#attendanceForm select[name="class"]');
    console.log('Attendance dropdown:', attendanceSelect);
    console.log('Attendance dropdown options:', attendanceSelect ? attendanceSelect.options.length : 'No dropdown found');
    
    if (attendanceSelect) {
        for (let i = 0; i < attendanceSelect.options.length; i++) {
            console.log(`Option ${i}: ${attendanceSelect.options[i].text} - ${attendanceSelect.options[i].value}`);
        }
    }
    console.log('=== END DEBUG ===');
}
// Add this function to generate and print receipts in A4 size
async function printReceipt(receiptNo) {
    try {
        // Get fee record details
        const feeRecord = feesData.find(f => f.receipt_no === receiptNo);
        if (!feeRecord) {
            alert('Fee record not found!');
            return;
        }

        // Get student details
        const student = studentsData.find(s => s.student_id === feeRecord.student_id);
        if (!student) {
            alert('Student details not found!');
            return;
        }

        // Create receipt HTML
        const receiptHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Fee Receipt - ${receiptNo}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 15mm;
                    }
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Arial', sans-serif;
                        font-size: 12px;
                        line-height: 1.4;
                        color: #333;
                        background: white;
                    }
                    
                    .receipt-container {
                        max-width: 100%;
                        padding: 10px;
                    }
                    
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #333;
                        padding-bottom: 8px;
                        margin-bottom: 12px;
                    }
                    
                    .institute-name {
                        font-size: 20px;
                        font-weight: bold;
                        color: #2d6b6b;
                        margin-bottom: 3px;
                    }
                    
                    .institute-address {
                        font-size: 10px;
                        color: #666;
                        margin-bottom: 5px;
                    }
                    
                    .receipt-title {
                        font-size: 16px;
                        font-weight: bold;
                        color: #333;
                        margin-top: 8px;
                    }
                    
                    .info-table {
                        width: 100%;
                        margin-bottom: 12px;
                        border-collapse: collapse;
                    }
                    
                    .info-table td {
                        padding: 4px 8px;
                        border: 1px solid #ddd;
                        font-size: 11px;
                    }
                    
                    .info-table td:first-child {
                        font-weight: bold;
                        background: #f5f5f5;
                        width: 35%;
                    }
                    
                    .amount-table {
                        width: 100%;
                        margin: 12px 0;
                        border-collapse: collapse;
                    }
                    
                    .amount-table th {
                        background: #2d6b6b;
                        color: white;
                        padding: 6px;
                        text-align: left;
                        font-size: 11px;
                        border: 1px solid #2d6b6b;
                    }
                    
                    .amount-table td {
                        padding: 5px 8px;
                        border: 1px solid #ddd;
                        font-size: 11px;
                    }
                    
                    .amount-table .text-right {
                        text-align: right;
                    }
                    
                    .amount-table .total-row {
                        background: #f8f9fa;
                        font-weight: bold;
                        font-size: 12px;
                    }
                    
                    .amount-table .highlight {
                        background: #fff3cd;
                        font-weight: bold;
                    }
                    
                    .signature-section {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 30px;
                    }
                    
                    .signature {
                        text-align: center;
                        width: 40%;
                    }
                    
                    .signature-line {
                        border-top: 1px solid #333;
                        margin-top: 35px;
                        margin-bottom: 5px;
                    }
                    
                    .signature-label {
                        font-size: 10px;
                        color: #666;
                    }
                    
                    .footer {
                        text-align: center;
                        margin-top: 20px;
                        padding-top: 10px;
                        border-top: 1px solid #ddd;
                        font-size: 9px;
                        color: #666;
                    }
                    
                    @media print {
                        body {
                            background: white;
                        }
                        .no-print {
                            display: none !important;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    <div class="header">
                        <div class="institute-name">AACEM INSTITUTE</div>
                        <div class="institute-address">
                            123 Education Street, Learning City, LC 12345 | Phone: +91-9876543210 | Email: info@aacem.edu.in
                        </div>
                        <div class="receipt-title">FEE PAYMENT RECEIPT</div>
                    </div>

                    <table class="info-table">
                        <tr>
                            <td>Receipt Number</td>
                            <td><strong>${receiptNo}</strong></td>
                            <td>Student ID</td>
                            <td><strong>${student.student_id}</strong></td>
                        </tr>
                        <tr>
                            <td>Payment Date</td>
                            <td>${formatDate(feeRecord.payment_date)}</td>
                            <td>Student Name</td>
                            <td>${student.name}</td>
                        </tr>
                        <tr>
                            <td>Payment Mode</td>
                            <td>${feeRecord.payment_mode.toUpperCase()}</td>
                            <td>Course</td>
                            <td>${student.course}</td>
                        </tr>
                    </table>

                    <table class="amount-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th class="text-right">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Total Course Fee</td>
                                <td class="text-right">${(student.fee_amount || 0).toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td>Previously Paid</td>
                                <td class="text-right">${((student.paid_amount || 0) - (feeRecord.amount || 0)).toLocaleString()}</td>
                            </tr>
                            <tr class="highlight">
                                <td><strong>Current Payment (${feeRecord.status || 'Completed'})</strong></td>
                                <td class="text-right"><strong>${(feeRecord.amount || 0).toLocaleString()}</strong></td>
                            </tr>
                            <tr class="total-row">
                                <td>Total Paid Amount</td>
                                <td class="text-right">${(student.paid_amount || 0).toLocaleString()}</td>
                            </tr>
                            <tr style="background: #ffe6e6;">
                                <td><strong>Remaining Due Amount</strong></td>
                                <td class="text-right" style="color: #dc3545;"><strong>${(student.due_amount || 0).toLocaleString()}</strong></td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="signature-section">
                        <div class="signature">
                            <div class="signature-line"></div>
                            <div class="signature-label">Student/Parent Signature</div>
                        </div>
                        <div class="signature">
                            <div class="signature-line"></div>
                            <div class="signature-label">Authorized Signature</div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>This is a computer generated receipt. No signature required.</p>
                        <p>Generated on: ${new Date().toLocaleString()}</p>
                    </div>

                    <div class="no-print" style="text-align: center; margin-top: 20px;">
                        <button onclick="window.print()" style="
                            background: #2d6b6b;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 14px;
                        ">
                            🖨️ Print Receipt
                        </button>
                        <button onclick="window.close()" style="
                            background: #6c757d;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 14px;
                            margin-left: 10px;
                        ">
                            ❌ Close
                        </button>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Open receipt in new window
        const receiptWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
        receiptWindow.document.write(receiptHtml);
        receiptWindow.document.close();

        // Focus on the new window
        receiptWindow.focus();

    } catch (error) {
        console.error('Error generating receipt:', error);
        alert('Failed to generate receipt. Please try again. Error: ' + error.message);
    }
}

// Add this function to view student fee history and print all receipts
async function viewStudentFeeHistory(studentId) {
    try {
        const student = studentsData.find(s => s.student_id === studentId);
        if (!student) {
            alert('Student not found!');
            return;
        }

        // Get all fee records for this student
        const studentFees = feesData.filter(f => f.student_id === studentId);
        
        if (studentFees.length === 0) {
            alert('No fee records found for this student!');
            return;
        }

        // Create modal to show fee history
        const modalHtml = `
            <div class="modal fade" id="feeHistoryModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-file-invoice-dollar me-2"></i>
                                Fee History - ${student.name} (${student.student_id})
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-4">
                                <div class="col-md-6">
                                    <div class="card bg-light">
                                        <div class="card-body">
                                            <h6 class="card-title">Fee Summary</h6>
                                            <div class="row">
                                                <div class="col-6">
                                                    <small class="text-muted">Total Fee:</small><br>
                                                    <strong>₹${(student.fee_amount || 0).toLocaleString()}</strong>
                                                </div>
                                                <div class="col-6">
                                                    <small class="text-muted">Total Paid:</small><br>
                                                    <strong class="text-success">₹${(student.paid_amount || 0).toLocaleString()}</strong>
                                                </div>
                                            </div>
                                            <div class="row mt-2">
                                                <div class="col-6">
                                                    <small class="text-muted">Due Amount:</small><br>
                                                    <strong class="text-danger">₹${(student.due_amount || 0).toLocaleString()}</strong>
                                                </div>
                                                <div class="col-6">
                                                    <small class="text-muted">Status:</small><br>
                                                    <span class="badge ${getFeeStatusClass(student.fee_status)}">${student.fee_status}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card bg-light">
                                        <div class="card-body text-center">
                                            <button class="btn btn-success btn-sm" onclick="printAllReceipts('${studentId}')">
                                                <i class="fas fa-print me-1"></i> Print All Receipts
                                            </button>
                                            <button class="btn btn-info btn-sm ms-2" onclick="exportStudentFeeHistory('${studentId}')">
                                                <i class="fas fa-download me-1"></i> Export History
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="table-responsive">
                                <table class="table table-hover table-sm">
                                    <thead class="table-dark">
                                        <tr>
                                            <th>Receipt No</th>
                                            <th>Date</th>
                                            <th>Amount</th>
                                            <th>Payment Mode</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${studentFees.map(fee => `
                                            <tr>
                                                <td><strong>${fee.receipt_no}</strong></td>
                                                <td>${formatDate(fee.payment_date)}</td>
                                                <td>₹${(fee.amount || 0).toLocaleString()}</td>
                                                <td><span class="badge bg-secondary">${fee.payment_mode}</span></td>
                                                <td><span class="badge bg-success">${fee.status}</span></td>
                                                <td>
                                                    <div class="btn-group btn-group-sm">
                                                        <button class="btn btn-outline-primary" onclick="printReceipt('${fee.receipt_no}')" title="Print Receipt">
                                                            <i class="fas fa-print"></i>
                                                        </button>
                                                        <button class="btn btn-outline-info" onclick="viewReceipt('${fee.receipt_no}')" title="View Details">
                                                            <i class="fas fa-eye"></i>
                                                        </button>
                                                        <button class="btn btn-outline-danger" onclick="deleteFeeRecord('${fee.receipt_no}')" title="Delete">
                                                            <i class="fas fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('feeHistoryModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('feeHistoryModal'));
        modal.show();

    } catch (error) {
        console.error('Error viewing fee history:', error);
        alert('Failed to load fee history. Error: ' + error.message);
    }
}

// Function to print all receipts for a student in A4 size
async function printAllReceipts(studentId) {
    try {
        const student = studentsData.find(s => s.student_id === studentId);
        if (!student) {
            alert('Student not found!');
            return;
        }

        const studentFees = feesData.filter(f => f.student_id === studentId);
        
        if (studentFees.length === 0) {
            alert('No fee records found for this student!');
            return;
        }

        // Create combined receipt HTML
        let combinedReceiptHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>All Receipts - ${student.name}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 15mm;
                    }
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Arial', sans-serif;
                        font-size: 12px;
                        line-height: 1.4;
                        color: #333;
                        background: white;
                    }
                    
                    .receipt-container {
                        page-break-after: always;
                        padding: 10px;
                    }
                    
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #333;
                        padding-bottom: 8px;
                        margin-bottom: 12px;
                    }
                    
                    .institute-name {
                        font-size: 20px;
                        font-weight: bold;
                        color: #2d6b6b;
                        margin-bottom: 3px;
                    }
                    
                    .receipt-title {
                        font-size: 16px;
                        font-weight: bold;
                        color: #333;
                        margin-top: 8px;
                    }
                    
                    .info-table {
                        width: 100%;
                        margin-bottom: 12px;
                        border-collapse: collapse;
                    }
                    
                    .info-table td {
                        padding: 4px 8px;
                        border: 1px solid #ddd;
                        font-size: 11px;
                    }
                    
                    .info-table td:first-child {
                        font-weight: bold;
                        background: #f5f5f5;
                        width: 35%;
                    }
                    
                    .amount-table {
                        width: 100%;
                        margin: 12px 0;
                        border-collapse: collapse;
                    }
                    
                    .amount-table th {
                        background: #2d6b6b;
                        color: white;
                        padding: 6px;
                        text-align: left;
                        font-size: 11px;
                        border: 1px solid #2d6b6b;
                    }
                    
                    .amount-table td {
                        padding: 5px 8px;
                        border: 1px solid #ddd;
                        font-size: 11px;
                    }
                    
                    .amount-table .text-right {
                        text-align: right;
                    }
                    
                    .amount-table .highlight {
                        background: #fff3cd;
                        font-weight: bold;
                    }
                    
                    .signature-section {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 30px;
                    }
                    
                    .signature {
                        text-align: center;
                        width: 40%;
                    }
                    
                    .signature-line {
                        border-top: 1px solid #333;
                        margin-top: 35px;
                        margin-bottom: 5px;
                    }
                    
                    .signature-label {
                        font-size: 10px;
                        color: #666;
                    }
                    
                    .footer {
                        text-align: center;
                        margin-top: 15px;
                        padding-top: 8px;
                        border-top: 1px solid #ddd;
                        font-size: 9px;
                        color: #666;
                    }
                    
                    @media print {
                        .no-print {
                            display: none !important;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="text-align: center; margin-bottom: 20px; padding: 20px;">
                    <button onclick="window.print()" style="
                        background: #2d6b6b;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        margin: 5px;
                    ">
                        🖨️ Print All Receipts
                    </button>
                    <button onclick="window.close()" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        margin: 5px;
                    ">
                        ❌ Close
                    </button>
                </div>
        `;

        // Add each receipt
        studentFees.forEach((fee, index) => {
            combinedReceiptHtml += `
                <div class="receipt-container">
                    <div class="header">
                        <div class="institute-name">AACEM INSTITUTE</div>
                        <div class="receipt-title">FEE PAYMENT RECEIPT</div>
                    </div>

                    <table class="info-table">
                        <tr>
                            <td>Receipt Number</td>
                            <td><strong>${fee.receipt_no}</strong></td>
                            <td>Student ID</td>
                            <td><strong>${student.student_id}</strong></td>
                        </tr>
                        <tr>
                            <td>Payment Date</td>
                            <td>${formatDate(fee.payment_date)}</td>
                            <td>Student Name</td>
                            <td>${student.name}</td>
                        </tr>
                        <tr>
                            <td>Payment Mode</td>
                            <td>${fee.payment_mode.toUpperCase()}</td>
                            <td>Course</td>
                            <td>${student.course}</td>
                        </tr>
                    </table>

                    <table class="amount-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th class="text-right">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="highlight">
                                <td><strong>Payment Amount (${fee.status || 'Completed'})</strong></td>
                                <td class="text-right"><strong>${(fee.amount || 0).toLocaleString()}</strong></td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="signature-section">
                        <div class="signature">
                            <div class="signature-line"></div>
                            <div class="signature-label">Student/Parent Signature</div>
                        </div>
                        <div class="signature">
                            <div class="signature-line"></div>
                            <div class="signature-label">Authorized Signature</div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>This is a computer generated receipt. No signature required.</p>
                        <p>Receipt ${index + 1} of ${studentFees.length} | Generated on: ${new Date().toLocaleString()}</p>
                    </div>
                </div>
            `;
        });

        combinedReceiptHtml += `
            </body>
            </html>
        `;

        // Open in new window
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        printWindow.document.write(combinedReceiptHtml);
        printWindow.document.close();
        printWindow.focus();

    } catch (error) {
        console.error('Error printing all receipts:', error);
        alert('Failed to print receipts. Error: ' + error.message);
    }
}

// Function to export student fee history as CSV
async function exportStudentFeeHistory(studentId) {
    try {
        const student = studentsData.find(s => s.student_id === studentId);
        if (!student) {
            alert('Student not found!');
            return;
        }

        const studentFees = feesData.filter(f => f.student_id === studentId);
        
        if (studentFees.length === 0) {
            alert('No fee records found for this student!');
            return;
        }

        // Create CSV content
        let csvContent = "Fee History for " + student.name + " (" + student.student_id + ")\n\n";
        csvContent += "Receipt No,Payment Date,Amount,Payment Mode,Status,Course\n";
        
        studentFees.forEach(fee => {
            csvContent += `"${fee.receipt_no}","${formatDate(fee.payment_date)}","${fee.amount}","${fee.payment_mode}","${fee.status}","${student.course}"\n`;
        });

        csvContent += `\nSummary\n`;
        csvContent += `Total Fee,${student.fee_amount}\n`;
        csvContent += `Total Paid,${student.paid_amount}\n`;
        csvContent += `Due Amount,${student.due_amount}\n`;
        csvContent += `Fee Status,${student.fee_status}\n`;
        csvContent += `Generated on,${new Date().toLocaleString()}\n`;

        // Create and download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fee_history_${student.student_id}_${new Date().getTime()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showSuccess('Fee history exported successfully!');

    } catch (error) {
        console.error('Error exporting fee history:', error);
        alert('Failed to export fee history. Error: ' + error.message);
    }
}

// Update the fees table to include print buttons
function updateFeesTable() {
    const tbody = document.getElementById('feesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (feesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-money-bill-wave"></i>
                        <p>No fee records found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }


    
    feesData.forEach(fee => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${fee.receipt_no || 'N/A'}</td>
            <td>${fee.student_name || 'Unknown'}</td>
            <td>${fee.course || 'No Course'}</td>
            <td>₹${(fee.amount || 0).toLocaleString()}</td>
            <td>${formatDate(fee.payment_date)}</td>
            <td>${fee.payment_mode || 'Unknown'}</td>
            <td><span class="status-badge bg-success">${fee.status || 'Unknown'}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-success btn-action" onclick="printReceipt('${fee.receipt_no}')" title="Print Receipt">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="btn btn-info btn-action" onclick="viewStudentFeeHistory('${fee.student_id}')" title="View History">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="btn btn-danger btn-action" onclick="deleteFeeRecord('${fee.receipt_no}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Also update the viewReceipt function to include print option
function viewReceipt(receiptNo) {
    const fee = feesData.find(f => f.receipt_no === receiptNo);
    if (fee) {
        const student = studentsData.find(s => s.student_id === fee.student_id);
        let details = `Receipt Details:\n\n`;
        details += `Receipt No: ${fee.receipt_no}\n`;
        details += `Student: ${fee.student_name}\n`;
        details += `Course: ${fee.course}\n`;
        details += `Amount: ₹${fee.amount}\n`;
        details += `Payment Date: ${formatDate(fee.payment_date)}\n`;
        details += `Payment Mode: ${fee.payment_mode}\n`;
        details += `Status: ${fee.status}\n\n`;
        
        if (student) {
            details += `Student Details:\n`;
            details += `Total Fee: ₹${student.fee_amount || 0}\n`;
            details += `Total Paid: ₹${student.paid_amount || 0}\n`;
            details += `Due Amount: ₹${student.due_amount || 0}\n`;
            details += `Fee Status: ${student.fee_status}\n\n`;
        }
        
        details += `Do you want to print this receipt?`;
        
        if (confirm(details)) {
            printReceipt(receiptNo);
        }
    }
}

// View individual class attendance
async function viewClassAttendance(className) {
    try {
        const response = await fetch(`http://localhost:5000/api/attendance/class/${className}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                // Show message when no attendance records found
                showInfo(`No attendance records found for ${className}`);
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Check if there are any attendance records
            if (!result.attendance || result.attendance.length === 0) {
                showInfo(`No attendance records found for ${className}`);
                return;
            }
            
            // Create a modal to show class attendance
            const modalHtml = `
                <div class="modal fade" id="classAttendanceModal" tabindex="-1">
                    <div class="modal-dialog modal-xl">
                        <div class="modal-content">
                            <div class="modal-header bg-primary text-white">
                                <h5 class="modal-title">
                                    <i class="fas fa-calendar-check me-2"></i>
                                    Attendance for ${className}
                                </h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead class="table-dark">
                                            <tr>
                                                <th>Date</th>
                                                <th>Present</th>
                                                <th>Absent</th>
                                                <th>Percentage</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${result.attendance.map(record => `
                                                <tr>
                                                    <td>${formatDate(record.date)}</td>
                                                    <td><span class="badge bg-success">${record.present_count}</span></td>
                                                    <td><span class="badge bg-danger">${record.absent_count}</span></td>
                                                    <td>
                                                        <div class="d-flex align-items-center">
                                                            <div class="progress flex-grow-1 me-2" style="height: 8px;">
                                                                <div class="progress-bar ${(record.percentage || 0) >= 80 ? 'bg-success' : (record.percentage || 0) >= 60 ? 'bg-warning' : 'bg-danger'}" 
                                                                     style="width: ${record.percentage}%"></div>
                                                            </div>
                                                            <span>${record.percentage}%</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div class="btn-group btn-group-sm">
                                                            <button class="btn btn-info" onclick="viewAttendanceDetails(${record.id})" title="View Details">
                                                                <i class="fas fa-eye"></i>
                                                            </button>
                                                            <button class="btn btn-danger" onclick="deleteAttendance(${record.id})" title="Delete">
                                                                <i class="fas fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal if any
            const existingModal = document.getElementById('classAttendanceModal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('classAttendanceModal'));
            modal.show();
        } else {
            showError('Failed to load class attendance: ' + result.message);
        }
    } catch (error) {
        console.error('Error viewing class attendance:', error);
        showError('Failed to load class attendance: ' + error.message);
    }
}

// Add this helper function for info messages
function showInfo(message) {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
        syncStatus.className = 'sync-status bg-info text-white';
        syncStatus.innerHTML = `<i class="fas fa-info-circle me-2"></i> ${message}`;
        syncStatus.style.display = 'block';
        
        setTimeout(() => {
            syncStatus.style.display = 'none';
        }, 3000);
    }
}


console.log('Dashboard JavaScript loaded successfully');
