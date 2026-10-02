# Phone Input with Country Code Component

## Overview
The `PhoneInputWithCountryCode` component is a reusable React component that provides an enhanced phone number input with country code selection. It features a scrollable dropdown list of all countries with their corresponding telephone country codes.

## Features
- **Country Code Selection**: Searchable dropdown with all countries and their codes
- **Automatic Phone Number Parsing**: Automatically extracts country code from full phone numbers
- **Read-Only Support**: Can be disabled for read-only fields
- **Error Handling**: Built-in error message display
- **Mobile Responsive**: Adapts layout for smaller screens
- **Accessible**: Proper labels and semantic HTML

## Installation
The component is already integrated into the following files:
- `src/components/PhoneInputWithCountryCode.jsx` - The main component
- `src/styles/PhoneInputWithCountryCode.module.css` - Component styles
- `src/utils/countryCodes.js` - Country code data

## Usage

### Basic Usage
```jsx
import PhoneInputWithCountryCode from "./components/PhoneInputWithCountryCode";

export default function MyForm() {
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+1");

  return (
    <PhoneInputWithCountryCode
      value={phone}
      onChange={(code, phoneNum) => {
        setPhone(phoneNum);
        setCountryCode(code);
      }}
      placeholder="Enter phone number"
      required
    />
  );
}
```

### With Error Handling
```jsx
<PhoneInputWithCountryCode
  value={phone}
  onChange={(code, phoneNum) => setPhone(phoneNum)}
  placeholder="Phone number"
  required
  error={phoneError}
  showLabel={true}
  label="Mobile Number"
/>
```

### Read-Only Mode
```jsx
<PhoneInputWithCountryCode
  value={currentPhone}
  readOnly={true}
  showLabel={true}
  label="Current Phone"
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | `""` | Current phone number value (with or without country code) |
| `onChange` | `function(countryCode, phoneNumber)` | `undefined` | Callback when phone or country code changes |
| `onCountryCodeChange` | `function(country)` | `undefined` | Optional callback when only country code changes |
| `placeholder` | `string` | `"Phone number"` | Input field placeholder text |
| `readOnly` | `boolean` | `false` | If true, fields are disabled and cannot be edited |
| `required` | `boolean` | `false` | If true, field is marked as required |
| `className` | `string` | `""` | Additional CSS class names |
| `error` | `string` | `""` | Error message to display below the input |
| `showLabel` | `boolean` | `false` | If true, displays label above input |
| `label` | `string` | `"Phone Number"` | Label text when showLabel is true |

## Integration Points

### 1. **AuthCard Component** (`src/components/AuthCard.jsx`)
Used during user registration to collect phone number with country code.
- Updates: Added `countryCode` state and integrated component
- Phone is sent as `${countryCode}${phone}` to registration endpoint

### 2. **SubscriptionForm Component** (`src/components/SubscriptionForm.jsx`)
Used in subscription/checkout flow to collect phone number.
- Updates: Added `countryCode` to form state
- Displays read-only when user is already authenticated

### 3. **SuperuserProfilePanel Component** (`src/components/SuperuserProfilePanel.jsx`)
Used in admin panel for profile editing.
- Updates: Added country code selection during edit mode
- Phone is saved as `${countryCode}${phone}` via PATCH `/api/auth/profile`

### 4. **ConsultationCalendar Component** (`src/components/ConsultationCalendar.jsx`)
Used during consultation booking flow.
- Updates: Added country code selection in booking form
- Phone is sent as `${countryCode}${phone}` to booking endpoint

## Backend Integration

The backend stores phone numbers as strings with country code prefix (e.g., "+15551234567"). No changes were required to the backend API:

- **POST /auth/register** - Accepts full phone number with country code
- **PATCH /auth/profile** - Updates phone with country code
- **POST /calendars/consultations/book** - Stores phone with country code

## Country Codes Data

The component uses `src/utils/countryCodes.js` which contains a comprehensive list of all countries with their:
- Country name
- Country code (e.g., "+1", "+44", "+86")
- ISO country code (e.g., "US", "GB", "CN")

## Styling

The component uses CSS Modules for scoped styling. Key classes:
- `.phoneInputContainer` - Main container
- `.inputWrapper` - Input and button wrapper
- `.countryButton` - Country selector button
- `.dropdown` - Dropdown menu
- `.countryList` - Scrollable country list
- `.phoneInput` - Phone number input field
- `.errorText` - Error message styling

### Customization
To customize the styling, modify `src/styles/PhoneInputWithCountryCode.module.css`. The component respects the application's design system variables through CSS custom properties.

## Validation

The component itself does not validate phone numbers (that's application-specific). It only:
1. Accepts the phone number as entered
2. Extracts and manages the country code
3. Passes both values to the onChange callback

Backend validation for phone format and duplicates is handled by each endpoint.

## Mobile Responsiveness

On mobile devices (max-width: 640px), the dropdown transforms from a side-by-side layout to a stacked layout for better usability.

## Accessibility Features

- Proper label associations when `showLabel={true}`
- Keyboard navigation support in dropdown
- Focus management for dropdown visibility
- Clear visual indicators for selected country
- Error messages linked to inputs

## Future Enhancements

Potential improvements for future versions:
1. Phone number format validation and auto-formatting
2. International phone number validation (libphonenumber-js)
3. Geographic location detection for pre-selecting country
4. Phone number carrier validation
5. SMS/WhatsApp verification integration

## Examples

### Registration Form
Users registering must select a country code before entering their phone number:
1. Component loads with "+1" (US) as default
2. User can search for their country
3. User enters phone number without formatting
4. On form submission, full number with code is sent to backend

### Profile Editing
Existing phone numbers are parsed automatically:
1. Component receives "+441234567890"
2. Recognizes "+44" (UK) and pre-selects it
3. Phone field shows "1234567890" (without code)
4. User can change country or phone number
5. Updated value is saved with country code

### Consultation Booking
Public users book consultations without authentication:
1. User selects country from dropdown
2. Enters phone number
3. System stores full number with country code
4. Confirmation email/SMS uses complete number
