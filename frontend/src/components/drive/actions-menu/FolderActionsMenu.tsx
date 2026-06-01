import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarTrigger,
} from "@/components/ui/menubar"
import { FolderProps } from "@/pages/Drive";
import { EllipsisVertical, FolderInput, Pen, Trash2 } from "lucide-react";
import { useState } from "react";
import Rename from "./Rename";
import Star from "./Star";
import Unstar from "./Unstar";
import Move from "./Move";
import MovetoTrash from "./MovetoTrash";
import Restore from "./Restore";
import Delete from "./Delete";
import { CustomButton } from "@/components/global/FormElements";

export default function FolderActionsMenu({ id, parent, isStarred, isDeleted }: FolderProps) {
    const [isRenameDialogOpen, setRenameDialogOpen] = useState(false);
    const [isMoveDialogOpen, setMoveDialogOpen] = useState(false);
    const [isTrashDialogOpen, setTrashDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);

    return (
        <>
            <Menubar className="invisible">
                <MenubarMenu>
                    <MenubarTrigger className="p-0">
                        <EllipsisVertical className="w-8 h-8 p-2 rounded-full hover:bg-zinc-800/5 dark:hover:bg-zinc-200/5 group-hover:visible" />
                    </MenubarTrigger>
                    <MenubarContent>

                        {/* rename */}
                        {
                            !isDeleted && <>
                            <MenubarItem className="p-0">
                                <CustomButton onClick={() => setRenameDialogOpen(true)} type="button" variant="secondary" className="w-full justify-start bg-transparent cursor-default">
                                    <Pen className="mr-1"/>
                                    Rename
                                </CustomButton>
                            </MenubarItem>
                            <MenubarSeparator />
                            </>
                        }

                        {/* star & unstar */}
                        {
                            isDeleted ? <></> :
                            isStarred ?
                            <>
                            <MenubarItem className="p-0">
                                <Unstar id={id} type="folder" />
                            </MenubarItem>
                            <MenubarSeparator />
                            </>
                            :
                            <>
                            <MenubarItem className="p-0">
                                <Star id={id} type="folder" />
                            </MenubarItem>
                            <MenubarSeparator />
                            </>
                        }

                        {/* move */}
                           {
                            !isDeleted && <>
                            <MenubarItem className="p-0">
                                <CustomButton onClick={() => setMoveDialogOpen(true)} type="button" variant="secondary" effect={false} className="w-full justify-start bg-transparent cursor-default">
                                    <FolderInput className="mr-1" />
                                    Move 
                                </CustomButton>
                            </MenubarItem>
                            <MenubarSeparator />
                            </>
                        }
                        
                        {/* move to trash & restore */}
                        {
                            !isDeleted ?
                            <MenubarItem className="p-0">
                                 <CustomButton onClick={() => setTrashDialogOpen(true)} type="button" variant="secondary" effect={false} className="w-full justify-start bg-transparent cursor-default">
                                    <Trash2 className="mr-1"/>
                                    Move to Trash
                                </CustomButton>
                            </MenubarItem>
                            :
                            <>
                            <MenubarItem className="p-0">
                                <Restore id={id} type="folder" />
                            </MenubarItem>
                            <MenubarSeparator />
                            </>
                        }

                        {/* delete */}
                        {
                            isDeleted && 
                            <MenubarItem className="p-0">
                                <CustomButton onClick={() => setDeleteDialogOpen(true)} type="button" variant="secondary" effect={false} className="w-full justify-start bg-transparent cursor-default">
                                    <Trash2 className="mr-1"/>
                                    Delete permanently
                                </CustomButton>
                            </MenubarItem>
                        }

                    </MenubarContent>
                </MenubarMenu>
            </Menubar>

            {/* rename dialog */}
            <Rename id={id} parent={parent} type="folder" isRenameDialogOpen={isRenameDialogOpen} setRenameDialogOpen={setRenameDialogOpen} />

            {/* move dialog */}
            <Move id={id} parent={parent} type="folder" isMoveDialogOpen={isMoveDialogOpen} setMoveDialogOpen={setMoveDialogOpen} />

            {/* trash dialog */}
            <MovetoTrash id={id} type="folder" isTrashDialogOpen={isTrashDialogOpen} setTrashDialogOpen={setTrashDialogOpen} />

            {/* delete dialog */}
            <Delete id={id} type="folder" isDeleteDialogOpen={isDeleteDialogOpen} setDeleteDialogOpen={setDeleteDialogOpen} />
        </>
  )
}
