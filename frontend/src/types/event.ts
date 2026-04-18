export interface EventData {
  id: string;
  name: string;
  date: string;
  description?: string;
  locationName: string;
  radius?: number;
  latitude: number;
  longitude: number;
  startTime?: string;
  endTime?: string;
  teams?: string;
  status: 'ongoing' | 'completed' | 'upcoming';
  creatorRole?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocationData {
  id: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radius?: number;
  department?: string;
  createdAt?: string;
}

export interface DialogState {
  isOpen: boolean;
  message?: string;
  title?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface TimePickerState {
  showStartTimePicker: boolean;
  showEndTimePicker: boolean;
  showEditStartTimePicker: boolean;
  showEditEndTimePicker: boolean;
}
