import { useEffect, useState } from 'react';
import './UpdateScreen.css';

function UpdateScreen() {
  const [status, setStatus] = useState('checking');
  const [currentVersion, setCurrentVersion] = useState('');
  const [availableVersion, setAvailableVersion] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (!window.electronApp?.onUpdateState) return undefined;

    const unsubscribe = window.electronApp.onUpdateState((state) => {
      setStatus(state?.status || 'checking');
      setCurrentVersion(state?.currentVersion || '');
      setAvailableVersion(state?.availableVersion || '');
      setProgress(state?.progress || 0);
      setError(state?.error || '');
      setCanInstall(Boolean(state?.canInstall));
    });

    return () => unsubscribe?.();
  }, []);

  const installUpdate = () => {
    if (window.electronApp?.installUpdate) {
      window.electronApp.installUpdate();
    }
  };

  const statusText = status === 'checking'
    ? 'Buscando actualizaciones'
    : status === 'available'
      ? 'Nueva actualización disponible'
      : status === 'downloading'
        ? 'Descargando actualización'
        : status === 'downloaded'
          ? 'Actualización lista para instalar'
          : status === 'installing'
            ? 'Instalando actualización'
            : status === 'error'
              ? 'No se pudo comprobar la actualización'
              : 'Verificando actualizaciones';

  return (
    <div className="update-screen">
      <div className="update-card">
        <div className="update-spinner" />
        <h1>{statusText}</h1>
        <p className="update-details">
          {availableVersion
            ? `Versión actual: ${currentVersion} • Nueva: ${availableVersion}`
            : `Versión instalada: ${currentVersion || 'desconocida'}`}
        </p>

        {progress > 0 && (
          <div className="update-progress">
            <div className="update-progress-bar" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        )}

        {progress > 0 && <p className="update-sub">{progress}% completado</p>}

        {error && <p className="update-error">{error}</p>}

        {canInstall && (
          <button className="update-action" onClick={installUpdate}>Instalar ahora</button>
        )}
      </div>
    </div>
  );
}

export default UpdateScreen;
