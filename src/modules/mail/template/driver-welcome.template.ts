export const getDriverWelcomeEmailTemplate = (
  driverName: string,
  companyName: string,
  email: string,
  temporaryPassword: string,
  loginUrl: string = 'https://driver.carline.com/login',
) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${companyName} - Driver Account</title>
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
            border-radius: 20px;
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .credentials-box {
            background-color: #fcf8f7;
            border-left: 4px solid #E05326;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 6px 6px 0;
        }
        .credentials-row {
            margin-bottom: 10px;
            font-size: 15px;
        }
        .credentials-row:last-child {
            margin-bottom: 0;
        }
        .label {
            font-weight: 600;
            color: #444444;
            display: inline-block;
            width: 140px;
        }
        .value {
            font-family: 'Courier New', Courier, monospace;
            color: #111111;
            font-weight: bold;
            background-color: #ffffff;
            padding: 3px 8px;
            border-radius: 4px;
            border: 1px solid #e0e0e0;
        }
        .btn-container {
            text-align: center;
            margin: 35px 0 25px;
        }
        .btn {
            background-color: #E05326;
            color: #ffffff !important;
            padding: 14px 32px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
            font-size: 16px;
            display: inline-block;
            box-shadow: 0 4px 10px rgba(224, 83, 38, 0.3);
        }
        .warning {
            font-size: 13px;
            color: #888888;
            font-style: italic;
            text-align: center;
            margin-top: 25px;
        }
        .footer {
            background-color: #f9f9f9;
            padding: 20px;
            text-align: center;
            font-size: 13px;
            color: #999999;
            border-top: 1px solid #eeeeee;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CARLINE</h1>
        </div>
        <div class="content">
            <span class="role-badge">DRIVER ACCOUNT</span>
            <h2>Welcome, ${driverName}!</h2>
            <p>You have been registered as a Driver for <strong>${companyName}</strong> on the Carline platform.</p>
            <p>Your driver profile, schedule, and vehicle assignments are ready. You can log in using the temporary credentials below:</p>
            
            <div class="credentials-box">
                <div class="credentials-row">
                    <span class="label">Portal / App URL:</span>
                    <span class="value" style="font-family: inherit; font-size: 13px;">${loginUrl}</span>
                </div>
                <div class="credentials-row" style="margin-top: 12px;">
                    <span class="label">Email Address:</span>
                    <span class="value">${email}</span>
                </div>
                <div class="credentials-row" style="margin-top: 12px;">
                    <span class="label">Temporary Password:</span>
                    <span class="value">${temporaryPassword}</span>
                </div>
            </div>

            <div class="btn-container">
                <a href="${loginUrl}" class="btn" target="_blank">Login to Driver Portal</a>
            </div>

            <p class="warning">For your security, please update your temporary password immediately upon your first login.</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Carline. All rights reserved.</p>
            <p>This is an automated notification. Please do not reply directly to this email.</p>
        </div>
    </div>
</body>
</html>
`;
