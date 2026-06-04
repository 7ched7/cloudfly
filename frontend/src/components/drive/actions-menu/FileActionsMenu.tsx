import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarTrigger,
} from "@/components/ui/menubar"
import { FileProps } from "@/pages/Drive";
import { EllipsisVertical, FolderInput, Info, Lock, Pen, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import Details from "./Details";
import Rename from "./Rename";
import Star from "./Star";
import Unstar from "./Unstar";
import Move from "./Move";
import ShareFile from "./ShareFile";
import MakeFilePrivate from "./MakeFilePrivate";
import DownloadFile from "./DownloadFile";
import MovetoTrash from "./MovetoTrash";
import Restore from "./Restore";
import Delete from "./Delete";
import { CustomButton } from "@/components/global/FormElements";

export default function FileActionsMenu({ id, parent, originalName, isStarred, isDeleted, publicKey }: FileProps) {
    const [isDetailsSheetOpen, setDetailsSheetOpen] = useState(false);
    const [isRenameDialogOpen, setRenameDialogOpen] = useState(false);
    const [isMoveDialogOpen, setMoveDialogOpen] = useState(false);
    const [isShareDialogOpen, setShareDialogOpen] = useState(false);
    const [isPrivateDialogOpen, setPrivateDialogOpen] = useState(false);
    const [isTrashDialogOpen, setTrashDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);

    return (
        <>
            <Menubar className="absolute top-2 right-2 invisible">
                <MenubarMenu>
                    <MenubarTrigger className="p-0">
                        <EllipsisVertical className="w-8 h-8 p-2 rounded-full hover:bg-zinc-800/5 dark:hover:bg-zinc-200/5 group-hover:visible text-white" />
                    </MenubarTrigger>
                    <MenubarContent>

                        {/* details */}
                        {
                            !isDeleted && <>
                            <MenubarItem className="p-0">
                                <CustomButton onClick={() => setDetailsSheetOpen(true)} type="button" variant="secondary" effect={false} className="w-full justify-start bg-transparent cursor-default">
                                    <Info className="mr-1"/>
                                    Details
                                </CustomButton>
                            </MenubarItem>
                            <MenubarSeparator />
                            </>
                        }

                        {/* rename */}
                        {
                            !isDeleted && <>
                            <MenubarItem className="p-0">
                                <CustomButton onClick={() => setRenameDialogOpen(true)} type="button" variant="secondary" effect={false} className="w-full justify-start bg-transparent cursor-default">
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
                                <Unstar id={id} type="file" />
                            </MenubarItem>
                            <MenubarSeparator />
                            </>
                            :
                            <>
                            <MenubarItem className="p-0">
                                <Star id={id} type="file" />
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

                        {/* share & make private */}
                        {
                            isDeleted ? <></> :
                            publicKey ? 
                            <>
                            <MenubarItem className="p-0">   
                                <CustomButton onClick={() => setPrivateDialogOpen(true)} type="button" variant="secondary" effect={false} className="w-full justify-start bg-transparent cursor-default">
                                    <Lock className="mr-1"/>
                                    Make private 
                                </CustomButton>
                            </MenubarItem>
                            <MenubarSeparator />
                            </>
                            :  
                            <>
                            <MenubarItem className="p-0">   
                                <CustomButton onClick={() => setShareDialogOpen(true)} type="button" variant="secondary" effect={false} className="w-full justify-start bg-transparent cursor-default">
                                    <Share2 className="mr-1"/>
                                    Share 
                                </CustomButton>
                            </MenubarItem>
                            <MenubarSeparator />
                            </>
                        }
                       
                        {/* download */}
                        {
                            !isDeleted && <>
                            <MenubarItem className="p-0">
                                <DownloadFile id={id} originalName={originalName} />
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
                                <Restore id={id} type="file" />
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

            {/* details sheet */}
            <Details id={id} originalName={originalName} isDetailsSheetOpen={isDetailsSheetOpen} setDetailsSheetOpen={setDetailsSheetOpen} />

            {/* rename dialog */}
            <Rename id={id} parent={parent} type="file" isRenameDialogOpen={isRenameDialogOpen} setRenameDialogOpen={setRenameDialogOpen} />

            {/* move dialog */}
            <Move id={id} parent={parent} type="file" isMoveDialogOpen={isMoveDialogOpen} setMoveDialogOpen={setMoveDialogOpen} />

            {/* share dialog */}
            <ShareFile id={id} publicKey={publicKey} isShareDialogOpen={isShareDialogOpen} setShareDialogOpen={setShareDialogOpen} />

            {/* private dialog */}
            <MakeFilePrivate id={id} isPrivateDialogOpen={isPrivateDialogOpen} setPrivateDialogOpen={setPrivateDialogOpen} />

            {/* trash dialog */}
            <MovetoTrash id={id} type="file" isTrashDialogOpen={isTrashDialogOpen} setTrashDialogOpen={setTrashDialogOpen} />

            {/* delete dialog */}
            <Delete id={id} type="file" isDeleteDialogOpen={isDeleteDialogOpen} setDeleteDialogOpen={setDeleteDialogOpen} />
        </>
  )
}
