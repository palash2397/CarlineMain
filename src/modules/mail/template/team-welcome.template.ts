export const getTeamMemberWelcomeEmailTemplate = (
  memberName: string,
  companyName: string,
  email: string,
  role: string,
  temporaryPassword: string,
  loginUrl: string = 'https://admin.carline.com/login',
) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${companyName} - Team Account</title>
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
        .role-badge {
            display: inline-block;
            background-color: #ffebe5;
            color: #E05326;
            padding: 4px 12px;
            border-radius: 12px;
            font-weight: bold;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-left: 6px;
        }
        .credentials-card {
            background-color: #fff9f6;
            border: 1px solid #ffd8c8;
            border-left: 4px solid #E05326;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 25px;
        }
        .credentials-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px dashed #ffd8c8;
        }
        .credentials-row:last-child {
            border-bottom: none;
        }
        .label {
            font-size: 13px;
            font-weight: 600;
            color: #666;
            text-transform: uppercase;
        }
        .value {
            font-size: 15px;
            font-weight: 700;
            color: #1a1a2e;
        }
        .password-box {
            font-family: 'Courier New', Courier, monospace;
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            padding: 6px 12px;
            border-radius: 4px;
            letter-spacing: 1.5px;
            color: #E05326;
        }
        .action-button {
            display: block;
            width: fit-content;
            margin: 30px auto;
            padding: 14px 32px;
            background-color: #E05326;
            color: #ffffff !important;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            border-radius: 6px;
            text-align: center;
            box-shadow: 0 4px 10px rgba(224, 83, 38, 0.3);
        }
        .warning {
            background-color: #fff8e1;
            border-left: 4px solid #ffb300;
            padding: 12px 16px;
            font-size: 13px;
            color: #795548;
            border-radius: 4px;
            margin-bottom: 25px;
        }
        .footer {
            background-color: #f8f9fa;
            border-top: 1px solid #eeeeee;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #888888;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CARLINE TAXI DISPATCH</h1>
        </div>
        <div class="content">
            <h2>Welcome, ${memberName}!</h2>
            <p>You have been added as a team member for <strong>${companyName}</strong> on the Carline Taxi Dispatch platform.</p>
            
            <p>Your account has been assigned the role: <span class="role-badge">${role}</span></p>

            <div class="credentials-card">
                <div class="credentials-row">
                    <span class="label">Login Email:</span>
                    <span class="value">${email}</span>
                </div>
                <div class="credentials-row">
                    <span class="label">Temporary Password:</span>
                    <span class="value password-box">${temporaryPassword}</span>
                </div>
                <div class="credentials-row">
                    <span class="label">Assigned Role:</span>
                    <span class="value">${role}</span>
                </div>
            </div>

            <div class="warning">
                <strong>Important:</strong> For security reasons, please log in and change your password immediately upon your first sign in.
            </div>

            <a href="${loginUrl}" class="action-button">Sign In to Portal</a>
            
            <p style="font-size: 13px; color: #777;">If the button above does not work, copy and paste the following URL into your browser:<br>
            <a href="${loginUrl}" style="color: #E05326;">${loginUrl}</a></p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Carline Taxi Dispatch. All rights reserved.</p>
            <p>This is an automated system email, please do not reply directly.</p>
        </div>
    </div>
</body>
</html>
`;
