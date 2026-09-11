export const getCompanyWelcomeEmailTemplate = (
  adminName: string,
  companyName: string,
  email: string,
  temporaryPassword: string,
  loginUrl: string = 'https://admin.carline.com/login',
) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Carline - Company Admin Credentials</title>
    <style>
        body {
            font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f7f6;
            margin: 0;
            padding: 0;
            color: #333333;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            overflow: hidden;
        }
        .header {
            background-color: #1a1a2e;
            padding: 30px 20px;
            text-align: center;
            border-bottom: 3px solid #E05326;
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            letter-spacing: 1px;
        }
        .content {
            padding: 40px 30px;
        }
        .content h2 {
            color: #1a1a2e;
            margin-top: 0;
            font-size: 20px;
        }
        .content p {
            font-size: 15px;
            line-height: 1.6;
            color: #555555;
            margin-bottom: 20px;
        }
        .credentials-card {
            background-color: #fff9f6;
            border: 1px solid #ffd8c8;
            border-left: 4px solid #E05326;
            border-radius: 6px;
            padding: 20px;
            margin: 25px 0;
        }
        .credential-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #ffe8de;
            font-size: 14px;
        }
        .credential-row:last-child {
            border-bottom: none;
        }
        .credential-label {
            font-weight: 600;
            color: #777;
        }
        .credential-value {
            font-weight: 700;
            color: #1a1a2e;
            font-family: monospace;
            font-size: 15px;
        }
        .btn-container {
            text-align: center;
            margin: 30px 0;
        }
        .btn {
            background-color: #E05326;
            color: #ffffff !important;
            padding: 12px 30px;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            border-radius: 6px;
            display: inline-block;
        }
        .notice {
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 15px;
            font-size: 13px;
            color: #666666;
            line-height: 1.5;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #888888;
            border-top: 1px solid #eeeeee;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Carline Taxi Dispatch</h1>
        </div>
        <div class="content">
            <h2>Welcome, ${adminName}!</h2>
            <p>Your company <strong>${companyName}</strong> has been successfully registered on the Carline Taxi Dispatch platform by the Super Admin.</p>
            
            <p>You have been assigned as the <strong>Company Administrator</strong>. Here are your account credentials to access your company dashboard:</p>
            
            <div class="credentials-card">
                <div class="credential-row">
                    <span class="credential-label">Portal URL:</span>
                    <span class="credential-value">${loginUrl}</span>
                </div>
                <div class="credential-row">
                    <span class="credential-label">Role:</span>
                    <span class="credential-value">Company Admin</span>
                </div>
                <div class="credential-row">
                    <span class="credential-label">Email:</span>
                    <span class="credential-value">${email}</span>
                </div>
                <div class="credential-row">
                    <span class="credential-label">Temporary Password:</span>
                    <span class="credential-value">${temporaryPassword}</span>
                </div>
            </div>

            <div class="btn-container">
                <a href="${loginUrl}" class="btn" target="_blank">Log In to Company Dashboard</a>
            </div>

            <div class="notice">
                <strong>🔒 Security Notice:</strong> For your security, please log in and change your temporary password immediately from your profile settings. Never share your credentials with anyone.
            </div>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Carline Taxi Dispatch. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;
