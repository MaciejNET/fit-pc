"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import ConfigurationPDF from "./ConfigurationPDF";
import { SelectedComponent } from "./BuilderView";

interface ExportPDFButtonProps {
    components: SelectedComponent[];
    totalPrice: number;
    buildName?: string | null;
    disabled?: boolean;
}

export default function ExportPDFButton({
    components,
    totalPrice,
    buildName,
    disabled = false,
}: ExportPDFButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleExportPDF = async () => {
        if (components.length === 0) return;

        setIsGenerating(true);

        try {
            // Generate PDF blob
            const blob = await pdf(
                <ConfigurationPDF
                    components={components}
                    totalPrice={totalPrice}
                    buildName={buildName || undefined}
                />
            ).toBlob();

            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;

            // Generate filename
            const date = new Date().toISOString().split("T")[0];
            const safeName = buildName
                ? buildName.replace(/[^a-zA-Z0-9]/g, "_")
                : "configuration";
            link.download = `FitPC_${safeName}_${date}.pdf`;

            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Cleanup
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={disabled || isGenerating || components.length === 0}
            className="w-full"
        >
            {isGenerating ? (
                <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                </>
            ) : (
                <>
                    <FileDown className="w-4 h-4 mr-2" />
                    Export PDF
                </>
            )}
        </Button>
    );
}
