"use client";

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
} from "@react-pdf/renderer";
import { SelectedComponent } from "./BuilderView";

const styles = StyleSheet.create({
    page: {
        flexDirection: "column",
        backgroundColor: "#ffffff",
        padding: 40,
        fontFamily: "Helvetica",
    },
    header: {
        marginBottom: 30,
        borderBottom: "2px solid #2563eb",
        paddingBottom: 15,
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#1e3a8a",
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 12,
        color: "#6b7280",
    },
    date: {
        fontSize: 10,
        color: "#9ca3af",
        marginTop: 8,
    },
    section: {
        marginTop: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#374151",
        marginBottom: 10,
        backgroundColor: "#f3f4f6",
        padding: 8,
    },
    table: {
        display: "flex",
        width: "100%",
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#2563eb",
        color: "#ffffff",
        padding: 10,
    },
    tableRow: {
        flexDirection: "row",
        borderBottom: "1px solid #e5e7eb",
        padding: 10,
    },
    tableRowAlt: {
        flexDirection: "row",
        borderBottom: "1px solid #e5e7eb",
        padding: 10,
        backgroundColor: "#f9fafb",
    },
    colCategory: {
        width: "25%",
        fontSize: 10,
    },
    colName: {
        width: "40%",
        fontSize: 10,
    },
    colQuantity: {
        width: "15%",
        fontSize: 10,
        textAlign: "center",
    },
    colPrice: {
        width: "20%",
        fontSize: 10,
        textAlign: "right",
    },
    headerText: {
        color: "#ffffff",
        fontWeight: "bold",
        fontSize: 10,
    },
    totalSection: {
        marginTop: 25,
        borderTop: "2px solid #2563eb",
        paddingTop: 15,
        flexDirection: "row",
        justifyContent: "flex-end",
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#374151",
        marginRight: 20,
    },
    totalValue: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#2563eb",
    },
    footer: {
        position: "absolute",
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: "center",
        fontSize: 9,
        color: "#9ca3af",
    },
    emptyMessage: {
        fontSize: 12,
        color: "#6b7280",
        textAlign: "center",
        marginTop: 40,
    },
});

// Category display names
const CATEGORY_NAMES: Record<string, string> = {
    CASE: "Case",
    MOTHERBOARD: "Motherboard",
    CPU: "Processor",
    CPU_COOLER: "CPU Cooler",
    RAM: "Memory",
    GPU: "Graphics Card",
    STORAGE: "Storage",
    PSU: "Power Supply",
};

interface ConfigurationPDFProps {
    components: SelectedComponent[];
    totalPrice: number;
    buildName?: string;
}

export default function ConfigurationPDF({
    components,
    totalPrice,
    buildName,
}: ConfigurationPDFProps) {
    const date = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>FitPC</Text>
                    <Text style={styles.subtitle}>
                        {buildName ? `Build: ${buildName}` : "PC Configuration"}
                    </Text>
                    <Text style={styles.date}>Generated: {date}</Text>
                </View>

                {/* Components Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Selected Components</Text>

                    {components.length === 0 ? (
                        <Text style={styles.emptyMessage}>
                            No components selected
                        </Text>
                    ) : (
                        <View style={styles.table}>
                            {/* Table Header */}
                            <View style={styles.tableHeader}>
                                <Text style={[styles.colCategory, styles.headerText]}>
                                    Category
                                </Text>
                                <Text style={[styles.colName, styles.headerText]}>
                                    Name
                                </Text>
                                <Text style={[styles.colQuantity, styles.headerText]}>
                                    Qty
                                </Text>
                                <Text style={[styles.colPrice, styles.headerText]}>
                                    Price
                                </Text>
                            </View>

                            {/* Table Rows */}
                            {components.map((component, index) => {
                                const quantity = component.quantity || 1;
                                const itemTotal = component.price * quantity;
                                const categoryName =
                                    CATEGORY_NAMES[component.category?.toUpperCase()] ||
                                    component.category;

                                return (
                                    <View
                                        key={component.id}
                                        style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                                    >
                                        <Text style={styles.colCategory}>{categoryName}</Text>
                                        <Text style={styles.colName}>{component.name}</Text>
                                        <Text style={styles.colQuantity}>{quantity}</Text>
                                        <Text style={styles.colPrice}>
                                            ${itemTotal.toFixed(2)}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>

                {/* Total Section */}
                {components.length > 0 && (
                    <View style={styles.totalSection}>
                        <Text style={styles.totalLabel}>Total:</Text>
                        <Text style={styles.totalValue}>${totalPrice.toFixed(2)}</Text>
                    </View>
                )}

                {/* Footer */}
                <Text style={styles.footer}>
                    FitPC - PC Builder • Automatically generated document
                </Text>
            </Page>
        </Document>
    );
}
