# Quick Reference Guide - PhoneInputWithCountryCode

## 🚀 Getting Started

### Import the Component
```jsx
import PhoneInputWithCountryCode from "../components/PhoneInputWithCountryCode";
```

### Basic Usage
```jsx
import { useState } from "react";
import PhoneInputWithCountryCode from "../components/PhoneInputWithCountryCode";

export default function MyForm() {
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+1");

  return (
    <form>
      <PhoneInputWithCountryCode
        value={phone}
        onChange={(code, phoneNum) => {
          setCountryCode(code);
          setPhone(phoneNum);
        }}
        placeholder="Enter phone number"
        required
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## 📋 Common Patterns

### Pattern 1: Show Label
```jsx
<PhoneInputWithCountryCode
  value={phone}
  onChange={(code, phoneNum) => setPhone(phoneNum)}
  showLabel={true}
  label="Mobile Number"
/>
```

### Pattern 2: With Error Message
```jsx
<PhoneInputWithCountryCode
  value={phone}
  onChange={(code, phoneNum) => setPhone(phoneNum)}
  error={error}
/>
```

### Pattern 3: Read-Only Display
```jsx
<PhoneInputWithCountryCode
  value={currentUserPhone}
  readOnly={true}
  showLabel={true}
  label="Current Phone"
/>
```

### Pattern 4: Track Country Changes Separately
```jsx
<PhoneInputWithCountryCode
  value={phone}
  onChange={(code, phoneNum) => setPhone(phoneNum)}
  onCountryCodeChange={(country) => {
    console.log(`User selected ${country.name}: ${country.code}`);
  }}
/>
```

### Pattern 5: Form Submission
```jsx
const handleSubmit = (e) => {
  e.preventDefault();
  
  // Send combined phone number with country code to backend
  const fullPhoneNumber = `${countryCode}${phone}`;
  
  fetch('/api/endpoint', {
    method: 'POST',
    body: JSON.stringify({ phone: fullPhoneNumber }),
  });
};
```

## 🎯 Real-World Examples

### Registration Form
```jsx
export default function RegisterForm() {
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    countryCode: "+1",
    firstName: "",
    lastName: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      phone: `${formData.countryCode}${formData.phone}`,
    };
    
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        onChange={(e) => setFormData({...formData, email: e.target.value})}
      />
      <input
        type="text"
        placeholder="First Name"
        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
      />
      <input
        type="text"
        placeholder="Last Name"
        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
      />
      <PhoneInputWithCountryCode
        value={formData.phone}
        onChange={(code, phone) => {
          setFormData({...formData, phone, countryCode: code});
        }}
        required
        showLabel={true}
        label="Phone Number"
      />
      <button type="submit">Sign Up</button>
    </form>
  );
}
```

### Profile Edit Form
```jsx
export default function ProfileEdit({ user }) {
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    countryCode: "+1",
  });

  const handleSave = async () => {
    const fullPhone = `${formData.countryCode}${formData.phone}`;
    
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        phone: fullPhone,
      }),
    });
  };

  return (
    <div>
      <input 
        value={formData.firstName} 
        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
      />
      <input 
        value={formData.lastName}
        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
      />
      <input 
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
      />
      <PhoneInputWithCountryCode
        value={formData.phone}
        onChange={(code, phone) => {
          setFormData({...formData, phone, countryCode: code});
        }}
        showLabel={true}
        label="Phone Number"
      />
      <button onClick={handleSave}>Save Profile</button>
    </div>
  );
}
```

## 🔧 Props Reference

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| value | string | "" | ✅ | Current phone number |
| onChange | function | undefined | ✅ | Callback: (countryCode, phoneNumber) |
| onCountryCodeChange | function | undefined | ❌ | Callback when country changes |
| placeholder | string | "Phone number" | ❌ | Placeholder text |
| readOnly | boolean | false | ❌ | Disable editing |
| required | boolean | false | ❌ | Mark field as required |
| className | string | "" | ❌ | Additional CSS classes |
| error | string | "" | ❌ | Error message to display |
| showLabel | boolean | false | ❌ | Show label above field |
| label | string | "Phone Number" | ❌ | Custom label text |

## 🎨 Styling Customization

### Override CSS
```css
/* Override individual styles */
.customPhoneInput :global(.phoneInputContainer) {
  /* Your styles */
}

.customPhoneInput :global(.countryButton) {
  /* Your styles */
}
```

### Use Additional Class Names
```jsx
<PhoneInputWithCountryCode
  className="my-custom-class"
  {...otherProps}
/>
```

## ❌ Common Mistakes to Avoid

### ❌ DON'T: Forget to combine country code with phone
```jsx
// WRONG - Only sends phone number
fetch('/api/save-phone', {
  body: JSON.stringify({ phone: phoneNumber }),
});

// CORRECT - Send complete number with country code
fetch('/api/save-phone', {
  body: JSON.stringify({ phone: `${countryCode}${phoneNumber}` }),
});
```

### ❌ DON'T: Assume component validates phone format
```jsx
// WRONG - Component doesn't validate format
// CORRECT - Validate on backend or use separate validator
```

### ❌ DON'T: Store country code separately from phone
```jsx
// WRONG - Splitting phone and country code in database
// CORRECT - Store together: "+15551234567"
```

### ❌ DON'T: Forget to update state for both phone and country
```jsx
// WRONG - Only updating one value
onChange={(code) => setPhone(code)}

// CORRECT - Updating both
onChange={(code, phone) => {
  setCountryCode(code);
  setPhone(phone);
}}
```

## 🔍 Debugging Tips

### Check Component Receives Value
```jsx
console.log("Current value:", value);
console.log("Country code state:", countryCode);
console.log("Phone number state:", phone);
```

### Verify onChange Callback
```jsx
<PhoneInputWithCountryCode
  onChange={(code, phone) => {
    console.log("Country code changed to:", code);
    console.log("Phone number changed to:", phone);
  }}
/>
```

### Check Dropdown Search
1. Type in search box
2. Verify results filter correctly
3. Check country name, code, and ISO code matching

### Mobile Testing
1. Test on actual mobile device (not just browser dev tools)
2. Check dropdown positioning on small screens
3. Verify touch interactions work smoothly

## 📞 API Integration Examples

### Send to API with Country Code
```jsx
const sendPhoneToAPI = async () => {
  const fullPhone = `${countryCode}${phone}`;
  
  const response = await fetch('/api/user/phone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: fullPhone }),
  });
  
  return response.json();
};
```

### Receive from API and Pre-fill
```jsx
const loadUserPhone = async () => {
  const response = await fetch('/api/user/phone');
  const data = await response.json();
  
  // Component will auto-parse "+15551234567" to country="+1", phone="5551234567"
  setPhone(data.phone);
};
```

## 🌍 Country Code Reference

### Top 10 Countries by Population
```
United States: +1
China: +86
India: +91
Indonesia: +62
Pakistan: +92
Brazil: +55
Nigeria: +234
Bangladesh: +880
Russia: +7
Mexico: +52
```

### Common Business Locations
```
Canada: +1
United Kingdom: +44
Germany: +49
France: +33
Japan: +81
Australia: +61
Singapore: +65
Switzerland: +41
Netherlands: +31
Sweden: +46
```

## 📱 Mobile-Specific Notes

- Dropdown automatically switches to stacked layout on mobile
- Touch-friendly tap targets (minimum 44px)
- Keyboard appears automatically on phone input
- Search works with mobile keyboards
- Scrolling is smooth on mobile devices

## 🆘 Troubleshooting

### Dropdown not opening
- Check if component is in read-only mode
- Verify browser JavaScript is enabled
- Check z-index in parent elements

### Country codes not showing correctly
- Verify `countryCodes.js` is imported
- Check console for import errors
- Verify file path is correct

### Phone input not updating
- Check onChange callback is implemented
- Verify state setters are working
- Check browser console for errors

### Styling looks wrong
- Import CSS module in component
- Check for conflicting CSS
- Verify class names are applied
- Use browser dev tools to inspect elements

## 📚 Additional Resources

- See `PHONE_INPUT_COMPONENT.md` for detailed documentation
- Check component source for inline comments
- Review integration examples in components:
  - AuthCard.jsx
  - SubscriptionForm.jsx
  - SuperuserProfilePanel.jsx
  - ConsultationCalendar.jsx

---

**Last Updated**: 2026-09-30
**Component Version**: 1.0
**Status**: ✅ Production Ready
