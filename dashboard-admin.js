import os
import uuid
from datetime import datetime, date
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client
import csv
from io import StringIO

# Load environment variables
load_dotenv()

# ==================== Flask Setup ====================
app = Flask(__name__)
CORS(app)

# Flask configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')

# Enhanced CORS configuration
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5000"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    },
    r"/admin/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5000"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type"]
    }
})

# Initialize Supabase client
url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# ==================== Helper Functions ====================
def generate_id(prefix, table_name):
    try:
        # Get the current maximum ID from the specific table
        response = supabase.table(table_name).select('id').order('id', desc=True).limit(1).execute()
        if response.data:
            # Find the highest numeric ID with the given prefix
            ids_with_prefix = [row['id'] for row in response.data if isinstance(row['id'], str) and row['id'].startswith(prefix)]
            if ids_with_prefix:
                last_id = max(ids_with_prefix)
                if last_id.startswith(prefix):
                    try:
                        last_num = int(last_id.replace(prefix, ''))
                        return f"{prefix}{last_num + 1:03d}"
                    except ValueError:
                        # If conversion fails, start from 1
                        return f"{prefix}001"
        return f"{prefix}001"
    except Exception as e:
        # Fallback: use timestamp-based ID
        timestamp = int(datetime.now().timestamp())
        return f"{prefix}{timestamp % 10000:04d}"

def get_table_count(table_name):
    try:
        response = supabase.table(table_name).select('id', count='exact').execute()
        return response.count or 0
    except Exception as e:
        print(f"Error getting count for {table_name}: {str(e)}")
        return 0

def validate_phone_number(phone):
    """Validate phone number format"""
    if not phone:
        return False
    # Remove any non-digit characters
    clean_phone = ''.join(filter(str.isdigit, str(phone)))
    return len(clean_phone) >= 10

def validate_email(email):
    """Basic email validation"""
    if not email:
        return True  # Email is optional
    return '@' in email and '.' in email

# ==================== Error Handlers ====================
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': 'Resource not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'message': 'Internal server error'}), 500

@app.errorhandler(413)
def too_large(error):
    return jsonify({'success': False, 'message': 'File too large'}), 413

@app.errorhandler(400)
def bad_request(error):
    return jsonify({'success': False, 'message': 'Bad request'}), 400

# ==================== Authentication APIs ====================
@app.route('/admin/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'success': False, 'message': 'Please enter both username and password'}), 400

        user_response = supabase.table('users').select('*').eq('username', username).eq('password', password).execute()
        
        if user_response.data:
            return jsonify({'success': True, 'message': 'Login successful!'})
        else:
            return jsonify({'success': False, 'message': 'Invalid username or password'}), 401

    except Exception as e:
        print(f"Error in login: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route("/admin/register", methods=["POST"])
def register_admin():
    try:
        data = request.get_json()
        full_name = data.get("full_name")
        email = data.get("email")
        phone = data.get("phone")
        username = data.get("username")
        password = data.get("password")

        if not all([full_name, email, phone, username, password]):
            return jsonify({"error": "⚠️ All fields are required!"}), 400

        # Validate email
        if not validate_email(email):
            return jsonify({"error": "⚠️ Invalid email format!"}), 400

        # Validate phone
        if not validate_phone_number(phone):
            return jsonify({"error": "⚠️ Invalid phone number format!"}), 400

        # Check if username already exists
        existing_user = supabase.table('admin_registration').select('username').eq('username', username).execute()
        if existing_user.data:
            return jsonify({"error": "⚠️ Username already exists!"}), 400

        response = supabase.table("admin_registration").insert({
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "username": username,
            "password": password,
            "created_at": datetime.now().isoformat()
        }).execute()

        if response.data:
            return jsonify({
                "message": "Admin registered successfully!",
                "admin": response.data[0]
            }), 201

        return jsonify({"error": "Registration failed. Try again."}), 400

    except Exception as e:
        return jsonify({"error": f"⚠️ Server Error: {str(e)}"}), 500

# ==================== Student Management ====================
@app.route('/api/students', methods=['GET'])
def get_students():
    try:
        response = supabase.table('students').select('*').order('created_at', desc=True).execute()
        return jsonify({'success': True, 'students': response.data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/add-student', methods=['POST'])
def add_student():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # ... your existing validation code ...
        
        student_id = generate_id("ST", 'students')
        
        new_student = {
            'student_id': student_id,
            'name': data.get('fullName', '').strip(),
            'parent_name': data.get('parentName', '').strip(),
            'phone': data.get('phone', '').strip(),
            'email': data.get('email', '').strip().lower(),
            'course': data.get('course', ''),
            'fee_amount': float(data.get('fee', 0)),
            'paid_amount': 0,
            'due_amount': float(data.get('fee', 0)),
            'address': data.get('address', '').strip(),
            'join_date': datetime.now().strftime('%Y-%m-%d'),
            'fee_status': 'Pending',
            'password': '123456',  # Now included in the same table
            'created_at': datetime.now().isoformat()
        }
        
        response = supabase.table('students').insert(new_student).execute()
        
        if response.data:
            return jsonify({
                'success': True, 
                'message': 'Student added successfully', 
                'studentId': student_id
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to save student'}), 500
        
    except Exception as e:
        print(f"Error adding student: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500





@app.route('/api/update-student/<student_id>', methods=['PUT'])
def update_student(student_id):
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['fullName', 'parentName', 'phone', 'course', 'fee']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Validate phone number
        if not validate_phone_number(data.get('phone')):
            return jsonify({'success': False, 'message': 'Invalid phone number format'}), 400
        
        # Validate email
        email = data.get('email')
        if email and not validate_email(email):
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400
        
        # Validate fee amount
        try:
            fee_amount = float(data.get('fee', 0))
            if fee_amount <= 0:
                return jsonify({'success': False, 'message': 'Fee amount must be positive'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid fee amount'}), 400
        
        # Check if student exists
        existing_student = supabase.table('students').select('student_id').eq('student_id', student_id).execute()
        if not existing_student.data:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        update_data = {
            'name': data.get('fullName', '').strip(),
            'parent_name': data.get('parentName', '').strip(),
            'phone': data.get('phone', '').strip(),
            'email': data.get('email', '').strip().lower(),
            'course': data.get('course', ''),
            'fee_amount': float(data.get('fee', 0)),
            'address': data.get('address', '').strip(),
            'updated_at': datetime.now().isoformat()
        }
        
        response = supabase.table('students').update(update_data).eq('student_id', student_id).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Student updated successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to update student'}), 500
            
    except Exception as e:
        print(f"Error updating student: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/delete-student/<student_id>', methods=['DELETE'])
def delete_student(student_id):
    try:
        # Check if student exists
        existing_student = supabase.table('students').select('student_id').eq('student_id', student_id).execute()
        if not existing_student.data:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        # Delete related records first
        try:
            # Delete fee records
            supabase.table('fees').delete().eq('student_id', student_id).execute()
        except Exception as e:
            print(f"Warning: Error deleting fee records: {str(e)}")
        
        try:
            # Delete marks records
            supabase.table('marks').delete().eq('student_id', student_id).execute()
        except Exception as e:
            print(f"Warning: Error deleting marks records: {str(e)}")
        
        # Delete the student
        response = supabase.table('students').delete().eq('student_id', student_id).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Student deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to delete student'}), 500
        
    except Exception as e:
        print(f"Error deleting student: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== Teacher Management ====================
@app.route('/api/teachers', methods=['GET'])
def get_teachers():
    try:
        response = supabase.table('teachers').select('*').order('created_at', desc=True).execute()
        return jsonify({'success': True, 'teachers': response.data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/add-teacher', methods=['POST'])
def add_teacher():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['fullName', 'subject', 'phone', 'salary', 'joiningDate']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Validate phone number
        if not validate_phone_number(data.get('phone')):
            return jsonify({'success': False, 'message': 'Invalid phone number format'}), 400
        
        # Validate email
        email = data.get('email')
        if email and not validate_email(email):
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400
        
        # Validate salary
        try:
            salary = float(data.get('salary', 0))
            if salary <= 0:
                return jsonify({'success': False, 'message': 'Salary must be positive'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid salary amount'}), 400
        
        teacher_id = generate_id("TCH", 'teachers')
        
        new_teacher = {
            'teacher_id': teacher_id,
            'name': data.get('fullName', '').strip(),
            'subject': data.get('subject', '').strip(),
            'phone': data.get('phone', '').strip(),
            'email': data.get('email', '').strip().lower(),
            'salary': float(data.get('salary', 0)),
            'joining_date': data.get('joiningDate', datetime.now().strftime('%Y-%m-%d')),
            'address': data.get('address', '').strip(),
            'created_at': datetime.now().isoformat()
        }
        
        response = supabase.table('teachers').insert(new_teacher).execute()
        
        if response.data:
            return jsonify({
                'success': True, 
                'message': 'Teacher added successfully', 
                'teacherId': teacher_id
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to save teacher'}), 500
        
    except Exception as e:
        print(f"Error adding teacher: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/update-teacher/<teacher_id>', methods=['PUT'])
def update_teacher(teacher_id):
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['fullName', 'subject', 'phone', 'salary', 'joiningDate']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Validate phone number
        if not validate_phone_number(data.get('phone')):
            return jsonify({'success': False, 'message': 'Invalid phone number format'}), 400
        
        # Validate email
        email = data.get('email')
        if email and not validate_email(email):
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400
        
        # Validate salary
        try:
            salary = float(data.get('salary', 0))
            if salary <= 0:
                return jsonify({'success': False, 'message': 'Salary must be positive'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid salary amount'}), 400
        
        # Check if teacher exists
        existing_teacher = supabase.table('teachers').select('teacher_id').eq('teacher_id', teacher_id).execute()
        if not existing_teacher.data:
            return jsonify({'success': False, 'message': 'Teacher not found'}), 404
        
        update_data = {
            'name': data.get('fullName', '').strip(),
            'subject': data.get('subject', '').strip(),
            'phone': data.get('phone', '').strip(),
            'email': data.get('email', '').strip().lower(),
            'salary': float(data.get('salary', 0)),
            'joining_date': data.get('joiningDate'),
            'address': data.get('address', '').strip(),
            'updated_at': datetime.now().isoformat()
        }
        
        response = supabase.table('teachers').update(update_data).eq('teacher_id', teacher_id).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Teacher updated successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to update teacher'}), 500
            
    except Exception as e:
        print(f"Error updating teacher: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/delete-teacher/<teacher_id>', methods=['DELETE'])
def delete_teacher(teacher_id):
    try:
        # Check if teacher exists
        existing_teacher = supabase.table('teachers').select('teacher_id').eq('teacher_id', teacher_id).execute()
        if not existing_teacher.data:
            return jsonify({'success': False, 'message': 'Teacher not found'}), 404
        
        response = supabase.table('teachers').delete().eq('teacher_id', teacher_id).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Teacher deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to delete teacher'}), 500
        
    except Exception as e:
        print(f"Error deleting teacher: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== Course Management ====================
@app.route('/api/courses', methods=['GET'])
def get_courses():
    try:
        response = supabase.table('courses').select('*').order('created_at', desc=True).execute()
        return jsonify({'success': True, 'courses': response.data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/add-course', methods=['POST'])
def add_course():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['courseName', 'courseCode', 'duration', 'feeAmount']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Validate duration
        try:
            duration = int(data.get('duration', 0))
            if duration <= 0:
                return jsonify({'success': False, 'message': 'Duration must be positive'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid duration'}), 400
        
        # Validate fee amount
        try:
            fee_amount = float(data.get('feeAmount', 0))
            if fee_amount <= 0:
                return jsonify({'success': False, 'message': 'Fee amount must be positive'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid fee amount'}), 400
        
        new_course = {
            'course_code': data.get('courseCode', '').upper().strip(),
            'course_name': data.get('courseName', '').strip(),
            'duration': int(data.get('duration', 0)),
            'fee_amount': float(data.get('feeAmount', 0)),
            'description': data.get('description', '').strip(),
            'category': data.get('category', 'computer'),
            'is_active': data.get('isActive', True),
            'created_at': datetime.now().isoformat()
        }
        
        # Check if course code already exists
        existing_response = supabase.table('courses').select('course_code').eq('course_code', new_course['course_code']).execute()
        
        if existing_response.data:
            return jsonify({'success': False, 'message': 'Course code already exists'}), 400
        
        response = supabase.table('courses').insert(new_course).execute()
        
        if response.data:
            return jsonify({
                'success': True, 
                'message': 'Course added successfully', 
                'courseCode': new_course['course_code']
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to save course'}), 500
        
    except Exception as e:
        print(f"Error adding course: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/update-course/<course_code>', methods=['PUT'])
def update_course(course_code):
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['courseName', 'duration', 'feeAmount']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Validate duration
        try:
            duration = int(data.get('duration', 0))
            if duration <= 0:
                return jsonify({'success': False, 'message': 'Duration must be positive'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid duration'}), 400
        
        # Validate fee amount
        try:
            fee_amount = float(data.get('feeAmount', 0))
            if fee_amount <= 0:
                return jsonify({'success': False, 'message': 'Fee amount must be positive'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid fee amount'}), 400
        
        # Check if course exists
        existing_course = supabase.table('courses').select('course_code').eq('course_code', course_code).execute()
        if not existing_course.data:
            return jsonify({'success': False, 'message': 'Course not found'}), 404
        
        update_data = {
            'course_name': data.get('courseName', '').strip(),
            'duration': int(data.get('duration', 0)),
            'fee_amount': float(data.get('feeAmount', 0)),
            'description': data.get('description', '').strip(),
            'category': data.get('category', 'computer'),
            'is_active': data.get('isActive', True),
            'updated_at': datetime.now().isoformat()
        }
        
        response = supabase.table('courses').update(update_data).eq('course_code', course_code).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Course updated successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to update course'}), 500
            
    except Exception as e:
        print(f"Error updating course: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/delete-course/<course_code>', methods=['DELETE'])
def delete_course(course_code):
    try:
        # Check if course exists
        existing_course = supabase.table('courses').select('course_code').eq('course_code', course_code).execute()
        if not existing_course.data:
            return jsonify({'success': False, 'message': 'Course not found'}), 404
        
        # Check if there are students enrolled in this course
        students_response = supabase.table('students').select('student_id').eq('course', course_code).execute()
        
        if students_response.data:
            return jsonify({'success': False, 'message': 'Cannot delete course. There are students enrolled in this course.'}), 400
        
        response = supabase.table('courses').delete().eq('course_code', course_code).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Course deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to delete course'}), 500
        
    except Exception as e:
        print(f"Error deleting course: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== Fee Management ====================
@app.route('/api/fees', methods=['GET'])
def get_fees():
    try:
        response = supabase.table('fees').select('*').order('payment_date', desc=True).execute()
        return jsonify({'success': True, 'fees': response.data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/record-payment', methods=['POST'])
def record_payment():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['studentId', 'amount', 'paymentDate', 'paymentMode']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Validate amount
        try:
            paying_amount = float(data.get('amount', 0))
            if paying_amount <= 0:
                return jsonify({'success': False, 'message': 'Payment amount must be positive'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid payment amount'}), 400
        
        # Get student details
        student_response = supabase.table('students').select('*').eq('student_id', data.get('studentId')).execute()
        
        if not student_response.data:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        student = student_response.data[0]
        paying_amount = float(data.get('amount', 0))
        
        # Check if paying amount exceeds due amount
        due_amount = float(student.get('due_amount', 0))
        if paying_amount > due_amount:
            return jsonify({'success': False, 'message': 'Payment amount cannot exceed due amount'}), 400
        
        # Calculate new amounts
        new_paid_amount = float(student.get('paid_amount', 0)) + paying_amount
        new_due_amount = float(student.get('fee_amount', 0)) - new_paid_amount
        new_fee_status = 'Paid' if new_due_amount <= 0 else 'Partial' if new_paid_amount > 0 else 'Pending'
        
        receipt_no = generate_id("RCPT", 'fees')
        
        # Add payment record
        new_payment = {
            'receipt_no': receipt_no,
            'student_id': data.get('studentId'),
            'student_name': student['name'],
            'course': student['course'],
            'amount': paying_amount,
            'payment_date': data.get('paymentDate', datetime.now().strftime('%Y-%m-%d')),
            'payment_mode': data.get('paymentMode', 'cash'),
            'status': 'Completed',
            'created_at': datetime.now().isoformat()
        }
        
        response = supabase.table('fees').insert(new_payment).execute()
        
        # Update student fee information
        if response.data:
            supabase.table('students').update({
                'paid_amount': new_paid_amount,
                'due_amount': new_due_amount,
                'fee_status': new_fee_status,
                'updated_at': datetime.now().isoformat()
            }).eq('student_id', data.get('studentId')).execute()
            
            return jsonify({
                'success': True, 
                'message': 'Payment recorded successfully', 
                'receiptNo': receipt_no
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to record payment'}), 500
        
    except Exception as e:
        print(f"Error recording payment: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/delete-fee/<receipt_no>', methods=['DELETE'])
def delete_fee(receipt_no):
    try:
        # Get fee record first to update student data
        fee_response = supabase.table('fees').select('*').eq('receipt_no', receipt_no).execute()
        
        if not fee_response.data:
            return jsonify({'success': False, 'message': 'Fee record not found'}), 404
        
        fee_record = fee_response.data[0]
        
        # Delete fee record
        response = supabase.table('fees').delete().eq('receipt_no', receipt_no).execute()
        
        if response.data:
            # Recalculate student fee status
            student_response = supabase.table('students').select('*').eq('student_id', fee_record['student_id']).execute()
            if student_response.data:
                student = student_response.data[0]
                fees_response = supabase.table('fees').select('amount').eq('student_id', fee_record['student_id']).execute()
                
                total_paid = sum(float(fee['amount']) for fee in fees_response.data) if fees_response.data else 0
                due_amount = float(student['fee_amount']) - total_paid
                fee_status = 'Paid' if due_amount <= 0 else 'Partial' if total_paid > 0 else 'Pending'
                
                supabase.table('students').update({
                    'paid_amount': total_paid,
                    'due_amount': due_amount,
                    'fee_status': fee_status,
                    'updated_at': datetime.now().isoformat()
                }).eq('student_id', fee_record['student_id']).execute()
            
            return jsonify({'success': True, 'message': 'Fee record deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to delete fee record'}), 500
        
    except Exception as e:
        print(f"Error deleting fee: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== Attendance Management - FIXED ====================
@app.route('/api/attendance/check-existing', methods=['GET'])
def check_existing_attendance():
    try:
        date = request.args.get('date')
        class_name = request.args.get('class')
        
        if not date:
            return jsonify({'success': False, 'message': 'Date is required'}), 400
        
        if not class_name:
            return jsonify({'success': False, 'message': 'Class is required'}), 400
        
        response = supabase.table('attendance').select('*').eq('date', date).eq('class', class_name).execute()
        
        if response.data:
            return jsonify({
                'success': True, 
                'exists': True, 
                'attendance': response.data[0],
                'message': 'Attendance already exists for this date and class'
            })
        else:
            return jsonify({'success': True, 'exists': False, 'attendance': None})
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/attendance/students/<course_code>', methods=['GET'])
def get_students_by_course(course_code):
    try:
        if not course_code:
            return jsonify({'success': False, 'message': 'Course code is required'}), 400
            
        response = supabase.table('students').select('student_id, name, course').eq('course', course_code).execute()
        return jsonify({'success': True, 'students': response.data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/mark-attendance', methods=['POST'])
def mark_attendance():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        attendance_date = data.get('date')
        class_name = data.get('class')
        attendance_data = data.get('attendance', {})
        
        if not attendance_date:
            return jsonify({'success': False, 'message': 'Date is required'}), 400
        
        if not class_name:
            return jsonify({'success': False, 'message': 'Class is required'}), 400
        
        if not attendance_data:
            return jsonify({'success': False, 'message': 'No attendance data provided'}), 400
        
        # Check if attendance already exists for this date and class
        existing_response = supabase.table('attendance').select('*').eq('date', attendance_date).eq('class', class_name).execute()
        
        # Calculate statistics
        present_count = sum(1 for status in attendance_data.values() if status == 'present')
        absent_count = sum(1 for status in attendance_data.values() if status == 'absent')
        total_count = present_count + absent_count
        percentage = (present_count / total_count * 100) if total_count > 0 else 0
        
        if existing_response.data:
            # Update existing attendance
            attendance_id = existing_response.data[0]['id']
            response = supabase.table('attendance').update({
                'attendance_data': attendance_data,
                'present_count': present_count,
                'absent_count': absent_count,
                'percentage': round(percentage, 2),
                'updated_at': datetime.now().isoformat()
            }).eq('id', attendance_id).execute()
        else:
            # Create new attendance record
            new_attendance = {
                'date': attendance_date,
                'class': class_name,
                'attendance_data': attendance_data,
                'present_count': present_count,
                'absent_count': absent_count,
                'percentage': round(percentage, 2),
                'created_at': datetime.now().isoformat()
            }
            
            response = supabase.table('attendance').insert(new_attendance).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Attendance marked successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to mark attendance'}), 500
        
    except Exception as e:
        print(f"Error marking attendance: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== NEW: Attendance Class-wise Data ====================
@app.route('/api/attendance/class/<class_name>', methods=['GET'])
def get_class_attendance(class_name):
    try:
        if not class_name:
            return jsonify({'success': False, 'message': 'Class name is required'}), 400
        
        # Get attendance records for the specific class
        response = supabase.table('attendance').select('*').eq('class', class_name).order('date', desc=True).execute()
        
        if response.data:
            return jsonify({
                'success': True, 
                'attendance': response.data,
                'class': class_name
            })
        else:
            return jsonify({
                'success': True, 
                'attendance': [],
                'class': class_name,
                'message': 'No attendance records found for this class'
            })
            
    except Exception as e:
        print(f"Error getting class attendance: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== NEW: Individual Attendance Record ====================
@app.route('/api/attendance/<attendance_id>', methods=['GET'])
def get_attendance_by_id(attendance_id):
    try:
        if not attendance_id:
            return jsonify({'success': False, 'message': 'Attendance ID is required'}), 400
        
        response = supabase.table('attendance').select('*').eq('id', attendance_id).execute()
        
        if response.data:
            return jsonify({
                'success': True, 
                'attendance': response.data[0]
            })
        else:
            return jsonify({'success': False, 'message': 'Attendance record not found'}), 404
            
    except Exception as e:
        print(f"Error getting attendance: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== NEW: Delete Attendance ====================
@app.route('/api/delete-attendance/<attendance_id>', methods=['DELETE'])
def delete_attendance(attendance_id):
    try:
        # Check if attendance exists
        existing_attendance = supabase.table('attendance').select('id').eq('id', attendance_id).execute()
        if not existing_attendance.data:
            return jsonify({'success': False, 'message': 'Attendance record not found'}), 404
        
        response = supabase.table('attendance').delete().eq('id', attendance_id).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Attendance record deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to delete attendance record'}), 500
        
    except Exception as e:
        print(f"Error deleting attendance: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== Marks Management ====================
@app.route('/api/marks', methods=['GET'])
def get_marks():
    try:
        response = supabase.table('marks').select('*').order('exam_date', desc=True).execute()
        return jsonify({'success': True, 'marks': response.data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/add-marks', methods=['POST'])
def add_marks():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['exam', 'studentId', 'subject', 'marks', 'examDate']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Get student details
        student_response = supabase.table('students').select('*').eq('student_id', data.get('studentId')).execute()
        
        if not student_response.data:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        student = student_response.data[0]
        
        # Validate marks
        try:
            marks_obtained = float(data.get('marks', 0))
            total_marks = float(data.get('totalMarks', 100))
            
            if marks_obtained < 0 or marks_obtained > total_marks:
                return jsonify({'success': False, 'message': f'Marks must be between 0 and {total_marks}'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid marks format'}), 400
        
        percentage = (marks_obtained / total_marks) * 100
        
        # Determine grade
        if percentage >= 90: grade = 'A+'
        elif percentage >= 80: grade = 'A'
        elif percentage >= 70: grade = 'B'
        elif percentage >= 60: grade = 'C'
        elif percentage >= 50: grade = 'D'
        elif percentage >= 40: grade = 'E'
        else: grade = 'F'
        
        new_marks = {
            'exam_type': data.get('exam', ''),
            'student_id': data.get('studentId'),
            'student_name': student['name'],
            'course': student['course'],
            'subject': data.get('subject', '').strip(),
            'marks_obtained': marks_obtained,
            'total_marks': total_marks,
            'percentage': round(percentage, 2),
            'grade': grade,
            'exam_date': data.get('examDate', ''),
            'created_at': datetime.now().isoformat()
        }
        
        response = supabase.table('marks').insert(new_marks).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Marks added successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to add marks'}), 500
        
    except Exception as e:
        print(f"Error adding marks: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/update-marks/<marks_id>', methods=['PUT'])
def update_marks(marks_id):
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['exam', 'studentId', 'subject', 'marks', 'examDate']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Get student details
        student_response = supabase.table('students').select('*').eq('student_id', data.get('studentId')).execute()
        
        if not student_response.data:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        student = student_response.data[0]
        
        # Validate marks
        try:
            marks_obtained = float(data.get('marks', 0))
            total_marks = float(data.get('totalMarks', 100))
            
            if marks_obtained < 0 or marks_obtained > total_marks:
                return jsonify({'success': False, 'message': f'Marks must be between 0 and {total_marks}'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid marks format'}), 400
        
        percentage = (marks_obtained / total_marks) * 100
        
        # Determine grade
        if percentage >= 90: grade = 'A+'
        elif percentage >= 80: grade = 'A'
        elif percentage >= 70: grade = 'B'
        elif percentage >= 60: grade = 'C'
        elif percentage >= 50: grade = 'D'
        elif percentage >= 40: grade = 'E'
        else: grade = 'F'
        
        update_data = {
            'exam_type': data.get('exam'),
            'student_id': data.get('studentId'),
            'student_name': student['name'],
            'course': student['course'],
            'subject': data.get('subject', '').strip(),
            'marks_obtained': marks_obtained,
            'total_marks': total_marks,
            'percentage': round(percentage, 2),
            'grade': grade,
            'exam_date': data.get('examDate'),
            'updated_at': datetime.now().isoformat()
        }
        
        response = supabase.table('marks').update(update_data).eq('id', marks_id).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Marks updated successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to update marks'}), 500
            
    except Exception as e:
        print(f"Error updating marks: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/delete-marks/<marks_id>', methods=['DELETE'])
def delete_marks(marks_id):
    try:
        # Check if marks record exists
        existing_marks = supabase.table('marks').select('id').eq('id', marks_id).execute()
        if not existing_marks.data:
            return jsonify({'success': False, 'message': 'Marks record not found'}), 404
        
        response = supabase.table('marks').delete().eq('id', marks_id).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Marks record deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to delete marks record'}), 500
        
    except Exception as e:
        print(f"Error deleting marks: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== Notification Management ====================
@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    try:
        response = supabase.table('notifications').select('*').order('created_at', desc=True).execute()
        return jsonify({'success': True, 'notifications': response.data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/send-notification', methods=['POST'])
def send_notification():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['title', 'message', 'audience']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        new_notification = {
            'title': data.get('title', '').strip(),
            'message': data.get('message', '').strip(),
            'audience': data.get('audience', 'all'),
            'priority': data.get('priority', 'medium'),
            'created_at': datetime.now().isoformat()
        }
        
        response = supabase.table('notifications').insert(new_notification).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Notification sent successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to send notification'}), 500
        
    except Exception as e:
        print(f"Error sending notification: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/delete-notification/<notification_id>', methods=['DELETE'])
def delete_notification(notification_id):
    try:
        # Check if notification exists
        existing_notification = supabase.table('notifications').select('id').eq('id', notification_id).execute()
        if not existing_notification.data:
            return jsonify({'success': False, 'message': 'Notification not found'}), 404
        
        response = supabase.table('notifications').delete().eq('id', notification_id).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Notification deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to delete notification'}), 500
        
    except Exception as e:
        print(f"Error deleting notification: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/update-notification/<notification_id>', methods=['PUT'])
def update_notification(notification_id):
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['title', 'message', 'audience']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Check if notification exists
        existing_notification = supabase.table('notifications').select('id').eq('id', notification_id).execute()
        if not existing_notification.data:
            return jsonify({'success': False, 'message': 'Notification not found'}), 404
        
        update_data = {
            'title': data.get('title', '').strip(),
            'message': data.get('message', '').strip(),
            'audience': data.get('audience', 'all'),
            'priority': data.get('priority', 'medium'),
            'updated_at': datetime.now().isoformat()
        }
        
        response = supabase.table('notifications').update(update_data).eq('id', notification_id).execute()
        
        if response.data:
            return jsonify({'success': True, 'message': 'Notification updated successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to update notification'}), 500
            
    except Exception as e:
        print(f"Error updating notification: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== Report Generation ====================
@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    try:
        data = request.get_json()
        report_type = data.get('reportType', '')
        format_type = data.get('format', 'csv')
        start_date = data.get('startDate')
        end_date = data.get('endDate')
        
        if not report_type:
            return jsonify({'success': False, 'message': 'Report type is required'}), 400
        
        output = StringIO()
        writer = csv.writer(output)
        filename = f"{report_type}_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        if report_type == 'students':
            response = supabase.table('students').select('*').execute()
            students = response.data or []
            
            writer.writerow(['Student ID', 'Name', 'Parent Name', 'Course', 'Join Date', 'Phone', 'Email', 'Fee Amount', 'Paid Amount', 'Due Amount', 'Fee Status', 'Address'])
            for student in students:
                writer.writerow([
                    student.get('student_id', ''),
                    student.get('name', ''),
                    student.get('parent_name', ''),
                    student.get('course', ''),
                    student.get('join_date', ''),
                    student.get('phone', ''),
                    student.get('email', ''),
                    student.get('fee_amount', 0),
                    student.get('paid_amount', 0),
                    student.get('due_amount', 0),
                    student.get('fee_status', ''),
                    student.get('address', '')
                ])
                
        elif report_type == 'teachers':
            response = supabase.table('teachers').select('*').execute()
            teachers = response.data or []
            
            writer.writerow(['Teacher ID', 'Name', 'Subject', 'Joining Date', 'Phone', 'Email', 'Salary', 'Address'])
            for teacher in teachers:
                writer.writerow([
                    teacher.get('teacher_id', ''),
                    teacher.get('name', ''),
                    teacher.get('subject', ''),
                    teacher.get('joining_date', ''),
                    teacher.get('phone', ''),
                    teacher.get('email', ''),
                    teacher.get('salary', 0),
                    teacher.get('address', '')
                ])
                
        elif report_type == 'courses':
            response = supabase.table('courses').select('*').execute()
            courses = response.data or []
            
            writer.writerow(['Course Code', 'Course Name', 'Duration', 'Fee Amount', 'Category', 'Description', 'Active'])
            for course in courses:
                writer.writerow([
                    course.get('course_code', ''),
                    course.get('course_name', ''),
                    course.get('duration', 0),
                    course.get('fee_amount', 0),
                    course.get('category', ''),
                    course.get('description', ''),
                    'Yes' if course.get('is_active') else 'No'
                ])
                
        elif report_type == 'fees':
            query = supabase.table('fees').select('*')
            if start_date:
                query = query.gte('payment_date', start_date)
            if end_date:
                query = query.lte('payment_date', end_date)
            response = query.execute()
            fees = response.data or []
            
            writer.writerow(['Receipt No', 'Student Name', 'Course', 'Amount', 'Payment Date', 'Payment Mode', 'Status'])
            for fee in fees:
                writer.writerow([
                    fee.get('receipt_no', ''),
                    fee.get('student_name', ''),
                    fee.get('course', ''),
                    fee.get('amount', 0),
                    fee.get('payment_date', ''),
                    fee.get('payment_mode', ''),
                    fee.get('status', '')
                ])
                
        elif report_type == 'attendance':
            query = supabase.table('attendance').select('*')
            if start_date:
                query = query.gte('date', start_date)
            if end_date:
                query = query.lte('date', end_date)
            response = query.execute()
            attendance_records = response.data or []
            
            writer.writerow(['Date', 'Class', 'Present Count', 'Absent Count', 'Percentage'])
            for record in attendance_records:
                writer.writerow([
                    record.get('date', ''),
                    record.get('class', ''),
                    record.get('present_count', 0),
                    record.get('absent_count', 0),
                    record.get('percentage', 0)
                ])
                
        elif report_type == 'marks':
            response = supabase.table('marks').select('*').execute()
            marks = response.data or []
            
            writer.writerow(['Exam Type', 'Student Name', 'Course', 'Subject', 'Marks Obtained', 'Total Marks', 'Percentage', 'Grade', 'Exam Date'])
            for mark in marks:
                writer.writerow([
                    mark.get('exam_type', ''),
                    mark.get('student_name', ''),
                    mark.get('course', ''),
                    mark.get('subject', ''),
                    mark.get('marks_obtained', 0),
                    mark.get('total_marks', 0),
                    mark.get('percentage', 0),
                    mark.get('grade', ''),
                    mark.get('exam_date', '')
                ])
        else:
            return jsonify({'success': False, 'message': 'Invalid report type'}), 400
        
        csv_data = output.getvalue()
        
        return jsonify({
            'success': True, 
            'message': 'Report generated successfully',
            'data': csv_data,
            'filename': filename
        })
        
    except Exception as e:
        print(f"Error generating report: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== Export Data ====================
@app.route('/api/export-data', methods=['GET'])
def export_data():
    try:
        data_type = request.args.get('type', 'students')
        
        if data_type not in ['students', 'teachers', 'courses', 'fees', 'attendance', 'marks']:
            return jsonify({'success': False, 'message': 'Invalid data type'}), 400
        
        output = StringIO()
        writer = csv.writer(output)
        filename = f"{data_type}_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        if data_type == 'students':
            response = supabase.table('students').select('*').execute()
            data = response.data or []
            writer.writerow(['Student ID', 'Name', 'Parent Name', 'Course', 'Join Date', 'Phone', 'Email', 'Fee Amount', 'Paid Amount', 'Due Amount', 'Fee Status', 'Address'])
            for item in data:
                writer.writerow([
                    item.get('student_id', ''),
                    item.get('name', ''),
                    item.get('parent_name', ''),
                    item.get('course', ''),
                    item.get('join_date', ''),
                    item.get('phone', ''),
                    item.get('email', ''),
                    item.get('fee_amount', 0),
                    item.get('paid_amount', 0),
                    item.get('due_amount', 0),
                    item.get('fee_status', ''),
                    item.get('address', '')
                ])
                
        elif data_type == 'teachers':
            response = supabase.table('teachers').select('*').execute()
            data = response.data or []
            writer.writerow(['Teacher ID', 'Name', 'Subject', 'Joining Date', 'Phone', 'Email', 'Salary', 'Address'])
            for item in data:
                writer.writerow([
                    item.get('teacher_id', ''),
                    item.get('name', ''),
                    item.get('subject', ''),
                    item.get('joining_date', ''),
                    item.get('phone', ''),
                    item.get('email', ''),
                    item.get('salary', 0),
                    item.get('address', '')
                ])
                
        elif data_type == 'courses':
            response = supabase.table('courses').select('*').execute()
            data = response.data or []
            writer.writerow(['Course Code', 'Course Name', 'Duration', 'Fee Amount', 'Category', 'Description', 'Active'])
            for item in data:
                writer.writerow([
                    item.get('course_code', ''),
                    item.get('course_name', ''),
                    item.get('duration', 0),
                    item.get('fee_amount', 0),
                    item.get('category', ''),
                    item.get('description', ''),
                    'Yes' if item.get('is_active') else 'No'
                ])
                
        elif data_type == 'fees':
            response = supabase.table('fees').select('*').execute()
            data = response.data or []
            writer.writerow(['Receipt No', 'Student Name', 'Course', 'Amount', 'Payment Date', 'Payment Mode', 'Status'])
            for item in data:
                writer.writerow([
                    item.get('receipt_no', ''),
                    item.get('student_name', ''),
                    item.get('course', ''),
                    item.get('amount', 0),
                    item.get('payment_date', ''),
                    item.get('payment_mode', ''),
                    item.get('status', '')
                ])
                
        elif data_type == 'attendance':
            response = supabase.table('attendance').select('*').execute()
            data = response.data or []
            writer.writerow(['Date', 'Class', 'All_Student_Name','Present Count', 'Absent Count', 'Percentage'])
            for item in data:
                writer.writerow([
                    item.get('date', ''),
                    item.get('class', ''),
                    item.get('attendance_data', ''),
                    item.get('present_count', 0),
                    item.get('absent_count', 0),
                    item.get('percentage', 0)
                ])
                
        elif data_type == 'marks':
            response = supabase.table('marks').select('*').execute()
            data = response.data or []
            writer.writerow(['Exam Type', 'Student_ID', 'Student Name', 'Course', 'Subject', 'Marks Obtained', 'Total Marks', 'Percentage', 'Grade', 'Exam Date'])
            for item in data:
                writer.writerow([
                    item.get('exam_type', ''),
                    item.get('student_id', ''),
                    item.get('student_name', ''),
                    item.get('course', ''),
                    item.get('subject', ''),
                    item.get('marks_obtained', 0),
                    item.get('total_marks', 0),
                    item.get('percentage', 0),
                    item.get('grade', ''),
                    item.get('exam_date', '')
                ])
        
        csv_data = output.getvalue()
        
        return jsonify({
            'success': True,
            'message': 'Data exported successfully',
            'data': csv_data,
            'filename': filename
        })
            
    except Exception as e:
        print(f"Error exporting data: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== Dashboard Data ====================
@app.route('/api/dashboard-data', methods=['GET'])
def get_dashboard_data():
    try:
        # Fetch all data from Supabase
        students_response = supabase.table('students').select('*').execute()
        teachers_response = supabase.table('teachers').select('*').execute()
        courses_response = supabase.table('courses').select('*').execute()
        fees_response = supabase.table('fees').select('*').execute()
        attendance_response = supabase.table('attendance').select('*').execute()
        marks_response = supabase.table('marks').select('*').execute()
        notifications_response = supabase.table('notifications').select('*').execute()
        
        # Calculate statistics
        total_revenue = sum(float(fee['amount']) for fee in fees_response.data) if fees_response.data else 0
        
        # Count students per course for the courses data
        courses_with_counts = []
        if courses_response.data:
            for course in courses_response.data:
                student_count_response = supabase.table('students').select('student_id', count='exact').eq('course', course['course_code']).execute()
                course['student_count'] = student_count_response.count or 0
                courses_with_counts.append(course)
        
        return jsonify({
            'success': True,
            'students': students_response.data or [],
            'teachers': teachers_response.data or [],
            'courses': courses_with_counts,
            'fees': fees_response.data or [],
            'attendance': attendance_response.data or [],
            'marks': marks_response.data or [],
            'notifications': notifications_response.data or [],
            'stats': {
                'total_students': len(students_response.data) if students_response.data else 0,
                'total_teachers': len(teachers_response.data) if teachers_response.data else 0,
                'total_courses': len(courses_response.data) if courses_response.data else 0,
                'total_revenue': total_revenue
            }
        })
        
    except Exception as e:
        print(f"Error getting dashboard data: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== Health Check ====================
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'success': True,
        'message': 'Server is running',
        'database': 'Supabase',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/sync-supabase', methods=['GET'])
def sync_supabase():
    try:
        return jsonify({'success': True, 'message': 'Data synchronized with Supabase'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== Fixed Student Dashboard APIs ====================

@app.route('/api/student-profile/<student_id>', methods=['GET'])
def get_student_profile(student_id):
    try:
        print(f"Fetching profile for student: {student_id}")
        response = supabase.table('students').select('*').eq('student_id', student_id).execute()
        print(f"Profile response: {response}")
        
        if response.data:
            student = response.data[0]
            # Format the response properly
            student_data = {
                'id': student.get('id'),
                'student_id': student.get('student_id'),
                'name': student.get('name'),
                'parent_name': student.get('parent_name'),
                'phone': student.get('phone'),
                'email': student.get('email'),
                'course': student.get('course'),
                'fee_amount': float(student.get('fee_amount', 0)),
                'paid_amount': float(student.get('paid_amount', 0)),
                'due_amount': float(student.get('due_amount', 0)),
                'address': student.get('address'),
                'join_date': student.get('join_date'),
                'fee_status': student.get('fee_status')
            }
            return jsonify({'success': True, 'student': student_data})
        else:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
            
    except Exception as e:
        print(f"Error in student-profile: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/student-fees/<student_id>', methods=['GET'])
def get_student_fees(student_id):
    try:
        print(f"Fetching fees for student: {student_id}")
        response = supabase.table('students').select('fee_amount, paid_amount, due_amount, fee_status').eq('student_id', student_id).execute()
        print(f"Fees response: {response}")
        
        if response.data:
            fee_data = response.data[0]
            # Convert to proper types
            fee_details = {
                'fee_amount': float(fee_data.get('fee_amount', 0)),
                'paid_amount': float(fee_data.get('paid_amount', 0)),
                'due_amount': float(fee_data.get('due_amount', 0)),
                'fee_status': fee_data.get('fee_status', 'Pending')
            }
            return jsonify({'success': True, 'fee_details': fee_details})
        else:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
            
    except Exception as e:
        print(f"Error in student-fees: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/student-attendance/<student_id>', methods=['GET'])
def get_student_attendance(student_id):
    try:
        print(f"Calculating attendance for student: {student_id}")
        
        # Get student details first
        student_response = supabase.table('students').select('course').eq('student_id', student_id).execute()
        if not student_response.data:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        course = student_response.data[0]['course']
        print(f"Student course: {course}")
        
        # Get all attendance records - we'll filter by course manually to handle case sensitivity
        attendance_response = supabase.table('attendance').select('*').execute()
        print(f"Total attendance records found: {len(attendance_response.data)}")
        
        present_count = 0
        absent_count = 0
        total_count = 0
        
        # Calculate attendance from real data - handle case insensitive matching
        for record in attendance_response.data:
            record_class = record.get('class', '')
            attendance_data = record.get('attendance_data', {})
            
            # Case insensitive comparison
            if record_class.upper() == course.upper():
                print(f"Found matching record for course {course}: {record['date']} - {attendance_data}")
                
                if student_id in attendance_data:
                    total_count += 1
                    if attendance_data[student_id] == 'present':
                        present_count += 1
                        print(f"Student {student_id} was present on {record['date']}")
                    else:
                        absent_count += 1
                        print(f"Student {student_id} was absent on {record['date']}")
                else:
                    print(f"Student {student_id} not found in attendance data for {record['date']}")
        
        percentage = (present_count / total_count * 100) if total_count > 0 else 0
        
        attendance_data = {
            'present_days': present_count,
            'absent_days': absent_count,
            'total_days': total_count,
            'percentage': round(percentage, 2)
        }
        
        print(f"Final attendance calculation for {student_id}: {attendance_data}")
        return jsonify({'success': True, 'attendance': attendance_data})
        
    except Exception as e:
        print(f"Error in student-attendance: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/student-results/<student_id>', methods=['GET'])
def get_student_results(student_id):
    try:
        print(f"Fetching results for student: {student_id}")
        response = supabase.table('marks').select('*').eq('student_id', student_id).execute()
        print(f"Results response: {response}")
        return jsonify({'success': True, 'results': response.data})
    except Exception as e:
        print(f"Error in student-results: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/student-notices', methods=['GET'])
def get_student_notices():
    try:
        print("Fetching notices for students")
        response = supabase.table('notifications').select('*').order('created_at', desc=True).execute()
        print(f"Notices response: {response}")
        return jsonify({'success': True, 'notices': response.data})
    except Exception as e:
        print(f"Error in student-notices: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/student-timetable/<student_id>', methods=['GET'])
def get_student_timetable(student_id):
    try:
        print(f"Fetching timetable for student: {student_id}")
        # For now, return empty array since timetable table might not exist
        # You can create a timetable table later
        return jsonify({'success': True, 'timetable': []})
    except Exception as e:
        print(f"Error in student-timetable: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500
    
@app.route('/api/student-login', methods=['POST'])
def student_login():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        student_id = data.get('student_id')
        password = data.get('password')
        
        if not student_id or not password:
            return jsonify({'success': False, 'message': 'Student ID and password are required'}), 400
        
        # Check in single students table
        response = supabase.table('students').select('*').eq('student_id', student_id).execute()
        
        if not response.data:
            return jsonify({'success': False, 'message': 'Student ID not found'}), 404
        
        student = response.data[0]
        
        # Check password
        if student.get('password') != password:
            return jsonify({'success': False, 'message': 'Invalid password'}), 401
        
        # Remove password from response for security
        student_data = {k: v for k, v in student.items() if k != 'password'}
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'student': student_data,
            'token': f"student_{student_id}"
        })
            
    except Exception as e:
        print(f"Student login error: {str(e)}")
        return jsonify({'success': False, 'message': 'Server error during login'}), 500

@app.route('/api/student-reset-password', methods=['POST'])
def student_reset_password():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        student_id = data.get('student_id')
        new_password = data.get('new_password')
        
        if not student_id or not new_password:
            return jsonify({'success': False, 'message': 'Student ID and new password are required'}), 400
        
        # Update password directly in students table
        update_response = supabase.table('students').update({
            'password': new_password,
            'updated_at': datetime.now().isoformat()
        }).eq('student_id', student_id).execute()
        
        if update_response.data:
            return jsonify({
                'success': True,
                'message': 'Password reset successfully'
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to reset password'}), 500
            
    except Exception as e:
        print(f"Password reset error: {str(e)}")
        return jsonify({'success': False, 'message': 'Server error during password reset'}), 500
    
# ==================== Student Verification API ====================
@app.route('/api/student-verify', methods=['POST'])
def student_verify():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        student_id = data.get('student_id')
        mobile_number = data.get('mobile_number')
        
        if not student_id or not mobile_number:
            return jsonify({'success': False, 'message': 'Student ID and mobile number are required'}), 400
        
        # Verify student exists and mobile number matches
        student_response = supabase.table('students').select('*').eq('student_id', student_id).eq('phone', mobile_number).execute()
        
        if not student_response.data:
            return jsonify({'success': False, 'message': 'Invalid Student ID or mobile number'}), 401
        
        return jsonify({
            'success': True,
            'message': 'Verification successful',
            'student_name': student_response.data[0]['name']
        })
            
    except Exception as e:
        print(f"Student verification error: {str(e)}")
        return jsonify({'success': False, 'message': 'Server error during verification'}), 500    
    
    
def generate_id(prefix, table_name):
    try:
        # Get all student IDs
        response = supabase.table(table_name).select('student_id').execute()
        
        if not response.data:
            return f"{prefix}001"
        
        # Find the maximum number
        max_num = 0
        for row in response.data:
            id_str = row['student_id']
            if id_str.startswith(prefix):
                try:
                    num = int(id_str[len(prefix):])  # "ST001" -> 1
                    if num > max_num:
                        max_num = num
                except ValueError:
                    continue
        
        next_num = max_num + 1
        return f"{prefix}{next_num:03d}"
        
    except Exception as e:
        print(f"ID generation failed: {str(e)}")
        return f"{prefix}{int(datetime.now().timestamp()) % 10000:04d}"
    
@app.route('/api/debug-students', methods=['GET'])
def debug_students():
    try:
        response = supabase.table('students').select('student_id, name, password').order('student_id').execute()
        
        return jsonify({
            'success': True,
            'students': response.data if response.data else [],
            'total_count': len(response.data) if response.data else 0
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    
    
# ==================== Teacher Login API ====================
@app.route('/api/teacher-login', methods=['POST'])
def teacher_login():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        teacher_id = data.get('teacher_id')
        password = data.get('password')
        
        if not teacher_id or not password:
            return jsonify({'success': False, 'message': 'Teacher ID and password are required'}), 400
        
        # Check password in teacher_passwords table
        password_response = supabase.table('teacher_passwords').select('*').eq('teacher_id', teacher_id).execute()
        
        if not password_response.data:
            return jsonify({'success': False, 'message': 'Teacher ID not found'}), 404
        
        stored_password = password_response.data[0]['password']
        
        # Check password
        if stored_password != password:
            return jsonify({'success': False, 'message': 'Invalid password'}), 401
        
        # Get teacher details from teachers table
        teacher_response = supabase.table('teachers').select('*').eq('teacher_id', teacher_id).execute()
        
        if not teacher_response.data:
            return jsonify({'success': False, 'message': 'Teacher details not found'}), 404
        
        teacher = teacher_response.data[0]
        
        # Prepare teacher data for response
        teacher_data = {
            'id': teacher.get('id'),
            'teacher_id': teacher.get('teacher_id'),
            'name': teacher.get('name'),
            'subject': teacher.get('subject'),
            'phone': teacher.get('phone'),
            'email': teacher.get('email'),
            'salary': teacher.get('salary'),
            'joining_date': teacher.get('joining_date'),
            'address': teacher.get('address'),
            'qualification': teacher.get('qualification')
        }
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'teacher': teacher_data,
            'token': f"teacher_{teacher_id}"
        })
            
    except Exception as e:
        print(f"Teacher login error: {str(e)}")
        return jsonify({'success': False, 'message': 'Server error during login'}), 500

# ==================== Teacher Verification API ====================
@app.route('/api/teacher-verify', methods=['POST'])
def teacher_verify():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        teacher_id = data.get('teacher_id')
        mobile_number = data.get('mobile_number')
        
        if not teacher_id or not mobile_number:
            return jsonify({'success': False, 'message': 'Teacher ID and mobile number are required'}), 400
        
        # Verify teacher exists and mobile number matches
        teacher_response = supabase.table('teachers').select('*').eq('teacher_id', teacher_id).eq('phone', mobile_number).execute()
        
        if not teacher_response.data:
            return jsonify({'success': False, 'message': 'Invalid Teacher ID or mobile number'}), 401
        
        return jsonify({
            'success': True,
            'message': 'Verification successful',
            'teacher_name': teacher_response.data[0]['name']
        })
            
    except Exception as e:
        print(f"Teacher verification error: {str(e)}")
        return jsonify({'success': False, 'message': 'Server error during verification'}), 500

# ==================== Teacher Reset Password API ====================
@app.route('/api/teacher-reset-password', methods=['POST'])
def teacher_reset_password():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        teacher_id = data.get('teacher_id')
        new_password = data.get('new_password')
        
        if not teacher_id or not new_password:
            return jsonify({'success': False, 'message': 'Teacher ID and new password are required'}), 400
        
        # Update password in teacher_passwords table
        update_response = supabase.table('teacher_passwords').update({
            'password': new_password,
            'updated_at': datetime.now().isoformat()
        }).eq('teacher_id', teacher_id).execute()
        
        if update_response.data:
            return jsonify({
                'success': True,
                'message': 'Password reset successfully'
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to reset password'}), 500
            
    except Exception as e:
        print(f"Teacher password reset error: {str(e)}")
        return jsonify({'success': False, 'message': 'Server error during password reset'}), 500    

# ==================== Run Flask ====================
if __name__ == '__main__':
    print("=" * 50)
    print("AACEM Institute Management System")
    print("Database: Supabase")
    print("=" * 50)
    
    print("System initialized successfully!")
    print("Starting Flask server on http://localhost:5000")
    print("=" * 50)
    
    app.run(debug=True, port=5000, host='0.0.0.0')
