export const getDriverRejectionEmailTemplate = (
  driverName: string,
  companyName: string,
  rejectionReason?: string,
) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Status Update - ${companyName}</title>
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
            border-bottom: 3px solid #dc3545;
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
        .status-badge {
            display: inline-block;
            background-color: #fde8e8;
            color: #dc3545;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .reason-box {
            background-color: #fcf8f8;
            border-left: 4px solid #dc3545;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 6px 6px 0;
        }
        .reason-title {
            font-weight: 600;
            color: #1a1a2e;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .reason-text {
            font-size: 15px;
            color: #555555;
            line-height: 1.5;
            margin: 0;
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
            <span class="status-badge">APPLICATION STATUS</span>
            <h2>Dear ${driverName},</h2>
            <p>Thank you for submitting your application to join <strong>${companyName}</strong> as a driver on the Carline platform.</p>
            <p>After reviewing your submitted details and credentials, we regret to inform you that your driver application has not been approved at this time.</p>
            
            ${
              rejectionReason
                ? `
            <div class="reason-box">
                <div class="reason-title">Reason Provided by Company:</div>
                <p class="reason-text">${rejectionReason}</p>
            </div>
            `
                : ''
            }

            <p>If you believe there was a misunderstanding or if you would like to submit updated credentials or documents, please reach out directly to the company administration or our support team.</p>
            <p>We appreciate your interest in driving with ${companyName}.</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${companyName} via Carline. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;
