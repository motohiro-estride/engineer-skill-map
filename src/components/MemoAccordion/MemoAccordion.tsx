import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface MemoAccordionProps {
  html: string;
}

export function MemoAccordion({ html }: MemoAccordionProps) {
  return (
    <div className="mt-2 rounded-md border border-sky-300/30 bg-sky-950/40 p-2 text-xs">
      <Accordion type="single" collapsible>
        <AccordionItem value="memo">
          <AccordionTrigger className="text-sky-100 [&_svg]:text-sky-300/80">
            <span className="flex items-center gap-1">
              📝 メモ
              <Badge
                variant="outline"
                className="border-sky-300/30 text-[10px] text-sky-100"
              >
                selfOnly
              </Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent className="memo-md mt-2 text-sky-100">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
