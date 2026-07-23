import { useEffect, useState } from 'react';

// Declaration for the global Google and gapi objects
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export function useDrivePicker(token: string | null) {
  const [isPickerLoaded, setIsPickerLoaded] = useState(false);

  useEffect(() => {
    // If gapi is not loaded on the window, inject the script
    if (!window.gapi) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = loadPicker;
      document.body.appendChild(script);
    } else {
      loadPicker();
    }

    function loadPicker() {
      window.gapi.load('picker', { callback: onPickerApiLoad });
    }

    function onPickerApiLoad() {
      setIsPickerLoaded(true);
    }
  }, []);

  const openPicker = (onSelect: (folderId: string, folderName: string) => void, onError?: (err: any) => void) => {
    if (!isPickerLoaded || !window.google || !window.google.picker || !token) {
      if (onError) onError(new Error('Picker is not ready or token is missing'));
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    const appId = clientId.split('-')[0]; // Extract App ID from Client ID

    const pickerCallback = (data: any) => {
      if (data.action === window.google.picker.Action.PICKED) {
        const doc = data.docs[0];
        const folderId = doc.id;
        const folderName = doc.name;
        onSelect(folderId, folderName);
      }
    };

    const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMimeTypes('application/vnd.google-apps.folder');

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setAppId(appId)
      .setCallback(pickerCallback)
      .build();
      
    picker.setVisible(true);
  };

  return { openPicker, isPickerLoaded };
}
