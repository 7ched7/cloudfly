import { getFileDetails } from "@/api/api";
import Animate from "@/components/global/Animate";
import { Separator } from "@/components/ui/separator";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { getColor } from "@/utils/color";
import { useQuery } from "@tanstack/react-query";
import { Globe, Loader2, Lock } from "lucide-react";

export default function Details({ id, originalName, isDetailsSheetOpen, setDetailsSheetOpen }: { id: string; originalName: string; isDetailsSheetOpen: boolean; setDetailsSheetOpen: React.Dispatch<React.SetStateAction<boolean>>; }) {
    const { data, isLoading } = useQuery({
        queryKey: ["file-details", id],
        queryFn: () => getFileDetails(id),
        enabled: isDetailsSheetOpen
    });
    
    return (
        <Sheet open={isDetailsSheetOpen} onOpenChange={setDetailsSheetOpen}>
            <SheetContent>
                {isLoading ? 
                <>
                    <SheetHeader>
                        <SheetTitle className="text-center">{originalName}</SheetTitle>
                        <SheetDescription className="text-center">Loading details about your file...</SheetDescription>
                    </SheetHeader>
                    <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="animate-spin" />
                    </div>
                </>
                :
                <Animate>
                    <SheetHeader>
                    <div>
                        <div className={`mx-auto flex items-center justify-center w-36 h-36 ${getColor(data?.mimeType)} font-semibold text-xl text-white uppercase rounded-md my-4 select-none pointer-events-none`}>
                            {data?.type}
                        </div>
                        <SheetTitle className="text-center">{data?.originalName}</SheetTitle>
                    </div>
                    <SheetDescription className="text-center">Details about your file</SheetDescription>
                    <Separator />
                    </SheetHeader>
                    <ul className="mt-4 flex flex-col items-start space-y-2 text-muted-foreground text-sm">
                        <li>
                            <p>
                                File name: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{data?.originalName}</span>
                            </p>
                        </li>
                        <li>
                            <p>
                                Size: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{data?.size}</span>
                            </p>
                        </li>
                        <li>
                            <p>
                                Type: <span className="text-zinc-800 dark:text-zinc-200 font-semibold uppercase">{data?.type}</span>
                            </p>
                        </li>
                        <li>
                            <p>
                                Starred: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{data?.isStarred ? "This file is starred" : "This file is not starred"}</span>
                            </p>
                        </li>
                        <li>
                            <p>
                                Created on: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{data?.createdAt}</span>
                            </p>
                        </li>
                        <li>
                            <p>
                                Updated on: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{data?.updatedAt}</span>
                            </p>
                        </li>
                    </ul>
                    <Separator className="my-4"/>
                    {
                        data?.publicKey ?
                        <div className="w-full text-muted-foreground text-sm">
                            <p><Globe className="scale-75 inline-block" /> This file is public</p>
                            <a className="text-bluedefault break-words" href={import.meta.env.VITE_BASE_URL + `/file/d/${data?.publicKey}`} target="_blank">
                                {import.meta.env.VITE_BASE_URL + `/file/d/${data?.publicKey}`}
                            </a>
                        </div>
                        :
                        <div className="w-full text-muted-foreground text-sm">
                            <p><Lock className="scale-75 inline-block" /> This file is private</p>                        
                        </div>
                    }
                </Animate>
                }
            </SheetContent>
        </Sheet>
    );
}
