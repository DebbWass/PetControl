import { useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { TextInput } from 'react-native-paper';
import { format, parse, isValid } from 'date-fns';

// Only import DateTimePicker on native – it's not available on web
let DateTimePicker: typeof import('@react-native-community/datetimepicker').default | null = null;
let DateTimePickerEvent: any;
if (Platform.OS !== 'web') {
  const mod = require('@react-native-community/datetimepicker');
  DateTimePicker = mod.default;
}

interface DateTimeInputProps {
  label: string;
  value: string;            // "DD/MM/YYYY" for date, "HH:MM" for time
  onChange: (val: string) => void;
  mode: 'date' | 'time';
  style?: object;
  placeholder?: string;
  optional?: boolean;
}

// Insert separators progressively as the user types digits
function autoFormatDate(newText: string, prevText: string): string {
  const isDeleting = newText.length < prevText.length;
  if (isDeleting) return newText; // Let backspace work naturally
  const digits = newText.replace(/\D/g, '').slice(0, 8);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function autoFormatTime(newText: string, prevText: string): string {
  const isDeleting = newText.length < prevText.length;
  if (isDeleting) return newText;
  const digits = newText.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function parseCurrentValue(value: string, mode: 'date' | 'time'): Date {
  if (mode === 'date') {
    const parsed = parse(value, 'dd/MM/yyyy', new Date());
    return isValid(parsed) ? parsed : new Date();
  }
  const parts = value.split(':');
  const h = parseInt(parts[0] ?? '8', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const d = new Date();
  d.setHours(isNaN(h) ? 8 : h, isNaN(m) ? 0 : m, 0, 0);
  return d;
}

/** Convert DD/MM/YYYY → YYYY-MM-DD for HTML date input */
function toHtmlDate(value: string): string {
  const d = parse(value, 'dd/MM/yyyy', new Date());
  if (!isValid(d)) return '';
  return format(d, 'yyyy-MM-dd');
}

/** Convert HH:MM → HH:MM (already correct for HTML time input) */
function toHtmlTime(value: string): string {
  return value;
}

export function DateTimeInput({ label, value, onChange, mode, style, placeholder, optional }: DateTimeInputProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const prevValueRef = useRef(value);
  const webInputRef = useRef<HTMLInputElement | null>(null);

  function handleTextChange(text: string) {
    const formatted = mode === 'date'
      ? autoFormatDate(text, prevValueRef.current)
      : autoFormatTime(text, prevValueRef.current);
    prevValueRef.current = formatted;
    onChange(formatted);
  }

  function handleNativePickerChange(_event: any, selected?: Date) {
    setPickerVisible(false);
    if (!selected) return;
    const formatted = mode === 'date'
      ? format(selected, 'dd/MM/yyyy')
      : format(selected, 'HH:mm');
    prevValueRef.current = formatted;
    onChange(formatted);
  }

  function openPicker() {
    if (Platform.OS === 'web') {
      // Create a hidden HTML input and trigger it
      const input = document.createElement('input');
      input.type = mode === 'date' ? 'date' : 'time';
      if (mode === 'date') {
        const htmlDate = toHtmlDate(value);
        if (htmlDate) input.value = htmlDate;
      } else {
        input.value = toHtmlTime(value);
      }
      input.style.position = 'fixed';
      input.style.top = '-9999px';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.addEventListener('change', (e) => {
        const val = (e.target as HTMLInputElement).value;
        if (!val) return;
        if (mode === 'date') {
          const [y, m, d] = val.split('-');
          if (y && m && d) {
            const formatted = `${d}/${m}/${y}`;
            prevValueRef.current = formatted;
            onChange(formatted);
          }
        } else {
          prevValueRef.current = val;
          onChange(val);
        }
        document.body.removeChild(input);
      });
      input.addEventListener('blur', () => {
        setTimeout(() => {
          if (document.body.contains(input)) document.body.removeChild(input);
        }, 300);
      });
      input.click();
      input.focus();
    } else {
      setPickerVisible(true);
    }
  }

  const placeholderText = placeholder ?? (mode === 'date' ? 'DD/MM/YYYY' : 'HH:MM');
  const fullLabel = optional ? `${label} (${mode === 'date' ? 'אופציונלי' : 'optional'})` : label;

  return (
    <View style={[styles.container, style]}>
      <TextInput
        label={fullLabel}
        value={value}
        onChangeText={handleTextChange}
        mode="outlined"
        keyboardType="default"
        placeholder={placeholderText}
        right={
          <TextInput.Icon
            icon={mode === 'date' ? 'calendar' : 'clock-outline'}
            onPress={openPicker}
          />
        }
      />
      {pickerVisible && DateTimePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={parseCurrentValue(value, mode)}
          mode={mode}
          display={Platform.OS === 'android' ? 'default' : 'spinner'}
          onChange={handleNativePickerChange}
          is24Hour
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
});
