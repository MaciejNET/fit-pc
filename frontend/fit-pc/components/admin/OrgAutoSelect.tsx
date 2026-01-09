"use client";

import { useOrganizationList } from "@clerk/nextjs";
import { useEffect } from "react";

export default function OrgAutoSelect() {
    const { isLoaded, setActive, userMemberships } = useOrganizationList({
        userMemberships: {
            infinite: true,
        },
    });

    useEffect(() => {
        if (isLoaded && setActive && userMemberships.data?.length > 0) {
            // Set the first organization as active
            const firstOrg = userMemberships.data[0].organization;
            setActive({ organization: firstOrg.id });
        }
    }, [isLoaded, setActive, userMemberships.data]);

    // This component doesn't render anything visible
    return null;
}
