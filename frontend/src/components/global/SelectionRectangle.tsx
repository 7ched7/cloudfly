import { FileProps, FolderProps, SelectedItemsProps } from '@/pages/Drive';
import React, { useState, useEffect, useRef } from 'react';

export default function SelectionRectangle({ 
    data, 
    setSelectedItems, 
    setIsSelecting, 
}: {  
    data: { files: FileProps[], folders: FolderProps[] }; 
    setSelectedItems: React.Dispatch<React.SetStateAction<SelectedItemsProps>>; 
    setIsSelecting: React.Dispatch<React.SetStateAction<boolean>>;
}) {
    const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
    const [currentPosition, setCurrentPosition] = useState({ x: 0, y: 0 });
    const [isSelectionActive, setSelectionActive] = useState(false);
    
    const containerRef = useRef<HTMLDivElement | null>(null);

    const handleMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        if (target.closest(".item") || 
        target.offsetParent?.id.startsWith("radix") ||
        target.id.startsWith("radix") ||
        target.closest(".select-all-button")) return;

        setStartPosition({
        x: e.clientX,
        y: e.clientY,
        });
        setSelectionActive(true);    
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isSelectionActive) {
            setIsSelecting(true);
        }
        setCurrentPosition({
            x: e.clientX,
            y: e.clientY,
        });
    };        

    const handleMouseUp = (e: MouseEvent) => { 
        if (isSelectionActive) {
            const fileElements = document.querySelectorAll(".file");
            const folderElements = document.querySelectorAll(".folder");
            
            if (data?.files?.length > 0 || data?.folders?.length > 0) {
                const selectionRect = {
                    left: Math.min(startPosition.x, e.clientX),
                    top: Math.min(startPosition.y, e.clientY),
                    right: Math.max(startPosition.x, e.clientX),
                    bottom: Math.max(startPosition.y, e.clientY),
                }; 
                
                let selectedFiles: any = []; 
                let selectedFolders: any = [];
                if (data?.files && data.files.length > 0) {
                    const intersectingFileIds = Array.from(fileElements)
                        .filter((file) => {
                            const rect = file.getBoundingClientRect();
                            return (
                                rect.left < selectionRect.right &&
                                rect.right > selectionRect.left &&
                                rect.top < selectionRect.bottom &&
                                rect.bottom > selectionRect.top
                            );
                        })
                        .map((file) => file.id);
                    selectedFiles = data?.files.filter(file => {
                        return intersectingFileIds.some((id) => String(file.id) === id);
                    })

                }
                if (data?.folders && data.folders.length > 0) {
                    const intersectingFolderIds = Array.from(folderElements)
                        .filter((folder) => {
                            const rect = folder.getBoundingClientRect();
                            return (
                                rect.left < selectionRect.right &&
                                rect.right > selectionRect.left &&
                                rect.top < selectionRect.bottom &&
                                rect.bottom > selectionRect.top
                            );
                        })
                        .map((folder) => folder.id);
                    selectedFolders = data?.folders.filter(folder => {
                        return intersectingFolderIds.some((id) => String(folder.id) === id);
                    })
                }
                    
                const updatedSelection = {
                    files: selectedFiles,
                    folders: selectedFolders,
                    count: selectedFiles?.length + selectedFolders?.length,
                } as SelectedItemsProps;          

                setSelectedItems(updatedSelection);
            }

            setSelectionActive(false);
            setTimeout(() => setIsSelecting(false), 50);
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isSelectionActive]);

    const width = currentPosition.x - startPosition.x;
    const height = currentPosition.y - startPosition.y;

    return isSelectionActive &&
        <div
            className="absolute bg-bluedefault/20 dark:bg-zinc-500/20 z-30"
            ref={containerRef}
            style={{
                left: Math.min(startPosition.x, currentPosition.x),
                top: Math.min(startPosition.y, currentPosition.y),
                width: Math.abs(width),
                height: Math.abs(height),
            }}
            >
        </div>
};