# Test Credentials

## Admin Account
- **Email**: contact.us@centraders.com
- **PIN**: 110078
- **Master Password** (for OTP bypass): addrika_admin_override

## Test User
- **Email**: test.user@example.com
- **Password**: Test@123

## Test Retailer
- **Email**: info@addrika.com
- **Password**: 12345

## Password Recovery Testing
- **User Recovery**: Uses mobile number to send OTP to registered email
- **Admin Recovery**: Uses email to send OTP, master password works as OTP

## Notes
- For email OTP testing, if email service is not configured, OTP is displayed in the API response (DEV MODE)
- Admin 2FA is always enabled and requires OTP verification
