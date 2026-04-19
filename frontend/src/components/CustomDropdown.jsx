import { useState, useRef, useEffect } from 'react'

export default function CustomDropdown({
  id,
  options,
  value,
  onChange,
  placeholder = "Select option...",
  isSensitive = () => false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(opt => opt === value)

  return (
    <div className="custom-dropdown" ref={dropdownRef} id={id}>
      <div 
        className={`dropdown-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={!selectedOption ? 'placeholder' : ''}>
          {selectedOption ? (
            <>
              {selectedOption}
              {isSensitive(selectedOption) && <span className="ml-2">⚠️</span>}
            </>
          ) : placeholder}
        </span>
        <svg 
          className={`chevron ${isOpen ? 'up' : 'down'}`} 
          width="12" height="7" viewBox="0 0 12 7" fill="none"
        >
          <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {isOpen && (
        <div className="dropdown-menu animate-fade-in-fast">
          {options.map((opt) => (
            <div
              key={opt}
              className={`dropdown-item ${opt === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(opt)
                setIsOpen(false)
              }}
            >
              <span className="flex items-center justify-between w-full">
                <span>{opt}</span>
                {isSensitive(opt) && <span className="text-amber-400">⚠️</span>}
              </span>
            </div>
          ))}
          {options.length === 0 && (
            <div className="dropdown-item disabled">No options available</div>
          )}
        </div>
      )}
    </div>
  )
}
