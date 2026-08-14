import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  deleteMirrorPhoto,
  fileFromMirrorPhoto,
  listMirrorPhotos,
  saveMirrorPhoto,
  type MirrorPhoto,
  type MirrorPhotoKind,
} from "@/lib/mirror-photos";

export type MirrorQueuedPhoto = {
  token: string;
  kind: MirrorPhotoKind;
  file: File;
};

type Ctx = {
  photos: MirrorPhoto[];
  queued: MirrorQueuedPhoto | null;
  addPhoto: (file: File, kind: MirrorPhotoKind) => Promise<void>;
  removePhoto: (id: string) => Promise<void>;
  queuePhoto: (photo: MirrorPhoto) => void;
  consumeQueued: (token: string) => void;
  refresh: () => Promise<void>;
};

const MirrorPhotosContext = createContext<Ctx | null>(null);

export function MirrorPhotosProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<MirrorPhoto[]>([]);
  const [queued, setQueued] = useState<MirrorQueuedPhoto | null>(null);

  const refresh = useCallback(async () => {
    setPhotos(await listMirrorPhotos());
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const addPhoto = useCallback(
    async (file: File, kind: MirrorPhotoKind) => {
      await saveMirrorPhoto(file, kind);
      await refresh();
    },
    [refresh],
  );

  const removePhoto = useCallback(
    async (id: string) => {
      await deleteMirrorPhoto(id);
      await refresh();
    },
    [refresh],
  );

  const queuePhoto = useCallback((photo: MirrorPhoto) => {
    setQueued({
      token: crypto.randomUUID(),
      kind: photo.kind,
      file: fileFromMirrorPhoto(photo),
    });
  }, []);

  const consumeQueued = useCallback((token: string) => {
    setQueued((cur) => (cur?.token === token ? null : cur));
  }, []);

  const value = useMemo(
    () => ({
      photos,
      queued,
      addPhoto,
      removePhoto,
      queuePhoto,
      consumeQueued,
      refresh,
    }),
    [photos, queued, addPhoto, removePhoto, queuePhoto, consumeQueued, refresh],
  );

  return (
    <MirrorPhotosContext.Provider value={value}>
      {children}
    </MirrorPhotosContext.Provider>
  );
}

export function useMirrorPhotos(): Ctx {
  const ctx = useContext(MirrorPhotosContext);
  if (!ctx) {
    throw new Error("useMirrorPhotos needs MirrorPhotosProvider");
  }
  return ctx;
}

export function useMirrorPhotosOptional(): Ctx | null {
  return useContext(MirrorPhotosContext);
}
