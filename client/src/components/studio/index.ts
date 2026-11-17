/**
 * The fitting studio's booking parts. SlotPicker is also the default export of './SlotPicker'
 * for the checkout's studio step.
 */
export { default as SlotPicker, type SlotPickerProps, type SlotValue } from './SlotPicker';
export { ServicePicker, type ServicePickerProps } from './ServicePicker';
export { CarChoice, carLabel, type CarChoiceProps, type CarValue } from './CarChoice';
export { BookingView, bookingMessage, bookingPath, type BookingViewProps } from './BookingView';
export { StudioContact, storePhones, type StudioContactProps } from './StudioContact';
export { StudioPaused } from './StudioPaused';
export {
  BOOKING_STATUS_DETAIL,
  BOOKING_STATUS_LABELS,
  CONSULT_ID,
  SLOT_REASON_DETAIL,
  SLOT_REASON_WORDS,
  addDays,
  calendarFile,
  chargeLabel,
  daysFrom,
  longDate,
  slotLabel,
  todayInIndia,
  weekdayOf,
} from './studioTime';
