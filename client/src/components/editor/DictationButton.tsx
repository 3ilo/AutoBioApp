import { useState, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { MicrophoneIcon } from '@heroicons/react/24/outline';
import { transcriptionApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessages';
import logger from '../../utils/logger';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface DictationButtonProps {
  editor: Editor | null;
  disabled?: boolean;
  onTitleExtracted?: (title: string) => void;
}

export function DictationButton({ editor, disabled, onTitleExtracted }: DictationButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const handleClick = useCallback(async () => {
    if (!editor) return;

    if (isRecording) {
      stopRecording();
      return;
    }

    if (!window.MediaRecorder) {
      setError('Dictation is not supported in this browser.');
      return;
    }

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsProcessing(true);
        if (chunks.length === 0) {
          setError('No audio recorded. Please try again.');
          setIsProcessing(false);
          return;
        }
        const blob = new Blob(chunks, { type: mimeType });
        try {
          const { data } = await transcriptionApi.transcribe(blob);
          if (data.cleaned) {
            editor.chain().focus().insertContent(data.cleaned).run();
          }
          if (data.title && onTitleExtracted) {
            onTitleExtracted(data.title);
          }
        } catch (err) {
          logger.error('Transcription failed', { error: err });
          setError(getErrorMessage(err));
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      if ((err as Error).name === 'NotAllowedError') {
        setError('Microphone permission denied.');
      } else {
        setError('Could not access microphone. Please try again.');
      }
      logger.error('Microphone access failed', { error: err });
    }
  }, [editor, isRecording, stopRecording, onTitleExtracted]);

  const isDisabled = disabled || isProcessing || !editor;

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`p-2 hover:bg-slate-200 transition-colors duration-150 ${
          isRecording ? 'bg-red-200' : ''
        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isRecording ? 'Stop recording' : isProcessing ? 'Transcribing...' : 'Dictate'}
      >
        {isProcessing ? (
          <LoadingSpinner size="sm" />
        ) : (
          <MicrophoneIcon
            className={`w-5 h-5 ${isRecording ? 'text-red-600' : 'text-slate-700'}`}
          />
        )}
      </button>
      {error && (
        <span className="text-xs text-red-600 mt-1 max-w-[120px] text-center">{error}</span>
      )}
    </div>
  );
}
