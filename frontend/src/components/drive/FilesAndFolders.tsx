import { useCallback, useEffect } from 'react';
import { Subtitle } from '../global/Titles'
import File from './File'
import Folder from './Folder'
import { FileProps, FolderProps, SelectedItemsProps } from '@/pages/Drive'

export default function FilesAndFolders({ 
    data, 
    handleChangeDirectory,
    setSelectedItems,
    selectedItems, 
    isSelecting,
}: {
    data: { files: FileProps[], folders: FolderProps[] };
    handleChangeDirectory?: (folder: FolderProps) => void;
    setSelectedItems: React.Dispatch<React.SetStateAction<SelectedItemsProps>>;
    selectedItems: SelectedItemsProps;
    isSelecting: boolean;
}) {
    // handle select item
    const handleSelectItem = useCallback((item: FileProps | FolderProps, type: "file" | "folder") => {
        const { files, folders } = selectedItems;
        let newSelectedItems = { ...selectedItems };
    
        if (type === "file") {
            const existingFile = files.find((f) => f.id === item.id);
            if (existingFile) {
                newSelectedItems.files = files.filter((f) => f.id !== item.id);
                newSelectedItems.count -= 1;
            } else {
                newSelectedItems.files = [...files, item as FileProps];
                newSelectedItems.count += 1;
            }
        } else if (type === "folder") {
            const existingFolder = folders.find((f) => f.id === item.id);
            if (existingFolder) {
                newSelectedItems.folders = folders.filter((f) => f.id !== item.id);
                newSelectedItems.count -= 1;
            } else {
                newSelectedItems.folders = [...folders, item as FolderProps];
                newSelectedItems.count += 1;
            }
        }
    
        if (newSelectedItems !== selectedItems) {
            setSelectedItems(newSelectedItems);
        }
    }, [selectedItems]);

    // unselect items if clicked outside 
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!isSelecting && !target.closest('.item') && !target.closest('.select-all-button')) {
                setSelectedItems({ files: [], folders: [], count: 0 });
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isSelecting]);

     return (
        <> 
            {
                data.folders && <>
                    <Subtitle className="mt-12 text-xs text-zinc-800 dark:text-zinc-200">Folders</Subtitle>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 3xl:grid-cols-8 gap-2 text-xs">
                        {
                            data.folders.map((folder: FolderProps) => (
                                <Folder 
                                    key={folder.id}
                                    folder={folder}
                                    handleChangeDirectory={handleChangeDirectory}
                                    handleSelectItem={handleSelectItem}
                                    isSelected={selectedItems.folders.some((f) => f.id === folder.id)}
                                />
                            ))
                        }
                    </div>
                </>
            }
            {
                data.files && <>
                    <Subtitle className="mt-12 text-xs text-zinc-800 dark:text-zinc-200">Files</Subtitle>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 3xl:grid-cols-8 gap-4 text-xs">
                        {
                            data.files.map((file: FileProps) => (
                                <File 
                                    key={file.id} 
                                    file={file}
                                    handleSelectItem={handleSelectItem}
                                    isSelected={selectedItems.files.some((f) => f.id === file.id)}
                                />
                            ))
                        }
                    </div>
                </>
            }
        </>
  )
}
