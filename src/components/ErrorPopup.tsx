import Dialog from './Dialog';

interface ErrorPopupProps {
    title: string;
    text: string;
    visible: boolean;
    onClose: () => void;
}

/** A dialog for something that went wrong. */
const ErrorPopup: React.FC<ErrorPopupProps> = ({ title, text, visible, onClose }) => (
    <Dialog visible={visible} onClose={onClose} title={title} message={text} icon="Alert" tone="danger" />
);

export default ErrorPopup;
