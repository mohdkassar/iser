import { useEffect, useRef, useState, useTransition } from "react";
import { adminApi } from "../api/admin";
export function useAdminData() {
    const [clients, setClients] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState(null);
    const [selectedSiteId, setSelectedSiteId] = useState(null);
    const [clientDetail, setClientDetail] = useState(null);
    const [siteDetail, setSiteDetail] = useState(null);
    const [error, setError] = useState(null);
    const [isPending, startTransition] = useTransition();
    const [isExtractingMetadata, setIsExtractingMetadata] = useState(false);
    const [isRunningRoomClustering, setIsRunningRoomClustering] = useState(false);
    const [metadataExtractionProgress, setMetadataExtractionProgress] = useState(0);
    const metadataProgressTimer = useRef(null);
    function stopMetadataProgressTimer() {
        if (metadataProgressTimer.current !== null) {
            window.clearInterval(metadataProgressTimer.current);
            metadataProgressTimer.current = null;
        }
    }
    function startMetadataProgressTimer(initialProgress) {
        stopMetadataProgressTimer();
        setMetadataExtractionProgress(initialProgress);
        metadataProgressTimer.current = window.setInterval(() => {
            setMetadataExtractionProgress((current) => {
                if (current >= 95) {
                    return current;
                }
                const increment = Math.max(1, Math.round((100 - current) * 0.08));
                return Math.min(95, current + increment);
            });
        }, 250);
    }
    useEffect(() => {
        adminApi
            .listClients()
            .then((result) => {
            setClients(result);
            if (result[0]) {
                setSelectedClientId(result[0].id);
            }
        })
            .catch(() => setError("Failed to load clients"));
    }, []);
    useEffect(() => {
        if (!selectedClientId)
            return;
        startTransition(() => {
            void refreshClient(selectedClientId);
        });
    }, [selectedClientId]);
    useEffect(() => {
        if (!selectedSiteId)
            return;
        startTransition(() => {
            adminApi
                .getSite(selectedSiteId)
                .then(setSiteDetail)
                .catch(() => setError("Failed to load site detail"));
        });
    }, [selectedSiteId]);
    useEffect(() => () => stopMetadataProgressTimer(), []);
    async function refreshSite() {
        if (!selectedSiteId)
            return;
        setSiteDetail(await adminApi.getSite(selectedSiteId));
    }
    async function refreshClient(clientId = selectedClientId) {
        if (!clientId)
            return;
        try {
            const result = await adminApi.getClient(clientId);
            setClientDetail(result);
            if (!result.sites.find((site) => site.id === selectedSiteId)) {
                setSelectedSiteId(result.sites[0]?.id ?? null);
            }
        }
        catch {
            setError("Failed to load client detail");
        }
    }
    async function runClustering() {
        await runRoomClustering();
    }
    async function runRoomClustering(threshold = 0.5) {
        if (!selectedSiteId)
            return;
        setIsRunningRoomClustering(true);
        try {
            await adminApi.runRoomClustering(selectedSiteId, { threshold });
            await refreshClient();
            await refreshSite();
        }
        finally {
            setIsRunningRoomClustering(false);
        }
    }
    async function extractMetadata(version, batchSize) {
        if (!selectedSiteId)
            return;
        setIsExtractingMetadata(true);
        startMetadataProgressTimer(0);
        try {
            await adminApi.extractMetadata(selectedSiteId, { version, batchSize });
            setMetadataExtractionProgress(100);
            await refreshClient();
            await refreshSite();
        }
        finally {
            stopMetadataProgressTimer();
            window.setTimeout(() => {
                setIsExtractingMetadata(false);
                setMetadataExtractionProgress(0);
            }, 250);
        }
    }
    async function clearSiteClustersAndMetadata() {
        if (!selectedSiteId)
            return;
        await adminApi.clearSiteClustersAndMetadata(selectedSiteId);
        setSiteDetail((current) => current
            ? {
                ...current,
                clusters: [],
                clusterCount: 0,
                datapoints: current.datapoints.map((datapoint) => ({
                    ...datapoint,
                    metadata: undefined,
                    metadataExtraction: undefined,
                })),
            }
            : current);
        await refreshClient();
        await refreshSite();
    }
    async function updateCluster(clusterId, status, label) {
        await adminApi.updateCluster(clusterId, {
            ...(status ? { status } : {}),
            ...(label ? { label } : {}),
        });
        await refreshSite();
    }
    return {
        clients,
        clientDetail,
        siteDetail,
        selectedClientId,
        selectedSiteId,
        error,
        isPending,
        isExtractingMetadata,
        isRunningRoomClustering,
        metadataExtractionProgress,
        setSelectedClientId,
        setSelectedSiteId,
        extractMetadata,
        runRoomClustering,
        runClustering,
        clearSiteClustersAndMetadata,
        updateCluster,
    };
}
