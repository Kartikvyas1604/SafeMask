import { AlertButton, AlertType } from '../components/CustomAlert';
import { AlertRef } from '../components/AlertProvider';

let alertComponentRef: AlertRef | null = null;

export const setAlertRef = (ref: AlertRef | null) => {
  alertComponentRef = ref;
};

export const showAlert = (props: {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
  transactionHash?: string;
  transactionStatus?: 'pending' | 'confirmed' | 'failed';
  showExplorerLink?: boolean;
  explorerUrl?: string;
  onCopyHash?: () => void;
  onViewExplorer?: () => void;
}) => {
  if (alertComponentRef) {
    alertComponentRef.show(props);
  } else {
    // Fallback to native Alert if ref not set
    const { Alert } = require('react-native');
    Alert.alert(props.title, props.message, props.buttons);
  }
};

// Convenience functions
export const showSuccess = (title: string, message?: string, buttons?: AlertButton[]) => {
  showAlert({ title, message, type: 'success', buttons });
};

export const showError = (title: string, message?: string, buttons?: AlertButton[]) => {
  showAlert({ title, message, type: 'error', buttons });
};

export const showInfo = (title: string, message?: string, buttons?: AlertButton[]) => {
  showAlert({ title, message, type: 'info', buttons });
};

export const showWarning = (title: string, message?: string, buttons?: AlertButton[]) => {
  showAlert({ title, message, type: 'warning', buttons });
};

export const showTransaction = (props: {
  title: string;
  transactionHash: string;
  transactionStatus: 'pending' | 'confirmed' | 'failed';
  message?: string;
  showExplorerLink?: boolean;
  explorerUrl?: string;
  onCopyHash?: () => void;
  onViewExplorer?: () => void;
  buttons?: AlertButton[];
}) => {
  showAlert({
    title: props.title,
    message: props.message,
    type: 'transaction',
    transactionHash: props.transactionHash,
    transactionStatus: props.transactionStatus,
    showExplorerLink: props.showExplorerLink,
    explorerUrl: props.explorerUrl,
    onCopyHash: props.onCopyHash,
    onViewExplorer: props.onViewExplorer,
    buttons: props.buttons,
  });
};

