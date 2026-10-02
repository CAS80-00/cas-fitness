import { useState, useRef, useEffect } from "react";
import { COUNTRY_CODES } from "../utils/countryCodes";
import styles from "../styles/PhoneInputWithCountryCode.module.css";

export default function PhoneInputWithCountryCode({
  value = "",
  onChange,
  placeholder = "Phone number",
  readOnly = false,
  required = false,
  error = "",
}) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);

  // Parse existing phone number to extract country code
  useEffect(() => {
    if (value && value.trim()) {
      const cleanValue = value.trim();
      
      for (const country of COUNTRY_CODES) {
        if (cleanValue.startsWith(country.code)) {
          setSelectedCountry(country);
          setPhoneNumber(cleanValue.substring(country.code.length).trim());
          return;
        }
      }
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setSearchTerm("");
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    setSearchTerm("");
    onChange?.(country.code, phoneNumber);
  };

  const handlePhoneChange = (e) => {
    const newPhone = e.target.value;
    setPhoneNumber(newPhone);
    onChange?.(selectedCountry.code, newPhone);
  };

  const filteredCountries = COUNTRY_CODES.filter((country) =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.code.includes(searchTerm) ||
    country.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.phoneInputContainer} ref={containerRef}>
      <div className={styles.inputWrapper}>
        <button
          type="button"
          onClick={handleButtonClick}
          className={`${styles.countryButton} ${readOnly ? styles.readOnly : ""} ${isDropdownOpen ? styles.active : ""}`}
          disabled={readOnly}
        >
          {selectedCountry?.code}
          {!readOnly && <span className={styles.arrow}>▼</span>}
        </button>

        <input
          type="tel"
          placeholder={placeholder}
          value={phoneNumber}
          onChange={handlePhoneChange}
          readOnly={readOnly}
          required={required}
          className={`${styles.phoneInput} ${error ? styles.error : ""}`}
        />
      </div>

      {isDropdownOpen && !readOnly && (
        <div className={styles.dropdownContainer}>
          <input
            type="text"
            placeholder="Search..."
            className={styles.searchBox}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <div className={styles.countryListContainer}>
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => (
                <div
                  key={`${country.country}-${country.code}`}
                  className={`${styles.countryItem} ${
                    selectedCountry?.country === country.country ? styles.selected : ""
                  }`}
                  onClick={() => handleCountrySelect(country)}
                >
                  <span className={styles.countryName}>{country.name}</span>
                  <span className={styles.countryCode}>{country.code}</span>
                </div>
              ))
            ) : (
              <div className={styles.noResults}>No countries found</div>
            )}
          </div>
        </div>
      )}

      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
