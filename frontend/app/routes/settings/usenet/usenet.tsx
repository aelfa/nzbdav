import { Button } from "~/components/ui/button";
import { Icon } from "~/components/ui/icon";
import { type Dispatch, type SetStateAction, useState, useCallback, useEffect, useMemo } from "react";
import { receiveMessage } from "~/utils/websocket-util";
import { isMaskedSecret } from "~/utils/config-mask";

const usenetConnectionsTopic = {'cxs': 'state'};

type UsenetSettingsProps = {
    config: Record<string, string>
    setNewConfig: Dispatch<SetStateAction<Record<string, string>>>
};

enum ProviderType {
    Disabled = 0,
    Pooled = 1,
    BackupAndStats = 2,
    BackupOnly = 3,
}

type ConnectionDetails = {
    Type: ProviderType;
    Host: string;
    Port: number;
    UseSsl: boolean;
    User: string;
    Pass: string;
    MaxConnections: number;
};

type ConnectionCounts = {
    live: number;
    active: number;
    max: number;
}

type UsenetProviderConfig = {
    Providers: ConnectionDetails[];
};

const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
    [ProviderType.Disabled]: "Disabled",
    [ProviderType.Pooled]: "Pool Connections",
    [ProviderType.BackupAndStats]: "Backup & Health Checks",
    [ProviderType.BackupOnly]: "Backup Only",
};

function parseProviderConfig(jsonString: string): UsenetProviderConfig {
    try {
        if (!jsonString || jsonString.trim() === "") {
            return { Providers: [] };
        }
        const parsed = JSON.parse(jsonString);
        return parsed && Array.isArray(parsed.Providers)
            ? parsed
            : { Providers: [] };
    } catch {
        return { Providers: [] };
    }
}

function serializeProviderConfig(config: UsenetProviderConfig): string {
    return JSON.stringify(config);
}

export function UsenetSettings({ config, setNewConfig }: UsenetSettingsProps) {
    // state
    const [showModal, setShowModal] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [connections, setConnections] = useState<{[index: number]: ConnectionCounts}>({});
    const providerConfig = useMemo(() => parseProviderConfig(config["usenet.providers"]), [config]);

    // handlers
    const handleAddProvider = useCallback(() => {
        setEditingIndex(null);
        setShowModal(true);
    }, []);

    const handleEditProvider = useCallback((index: number) => {
        setEditingIndex(index);
        setShowModal(true);
    }, []);

    const handleDeleteProvider = useCallback((index: number) => {
        const newProviderConfig = { ...providerConfig };
        newProviderConfig.Providers = providerConfig.Providers.filter((_, i) => i !== index);
        setNewConfig({ ...config, "usenet.providers": serializeProviderConfig(newProviderConfig) });
    }, [config, providerConfig, setNewConfig]);

    const handleCloseModal = useCallback(() => {
        setShowModal(false);
        setEditingIndex(null);
    }, []);

    const handleSaveProvider = useCallback((provider: ConnectionDetails) => {
        const newProviderConfig = { ...providerConfig };
        if (editingIndex !== null) {
            newProviderConfig.Providers[editingIndex] = provider;
        } else {
            newProviderConfig.Providers.push(provider);
        }
        setNewConfig({ ...config, "usenet.providers": serializeProviderConfig(newProviderConfig) });
        handleCloseModal();
    }, [config, providerConfig, editingIndex, setNewConfig, handleCloseModal]);

    const handleConnectionsMessage = useCallback((message: string) => {
        const parts = (message || "0|0|0|0|1|0").split("|");
        const [index, live, idle, _0, _1, _2] = parts.map((x: any) => Number(x));
        if (showModal) return;
        if (index >= providerConfig.Providers.length) return;
        setConnections(prev => ({...prev, [index]: {
            active: live - idle,
            live: live,
            max: providerConfig.Providers[index]?.MaxConnections || 1
        }}));
    }, [setConnections]);

    // effects
    useEffect(() => {
        let ws: WebSocket;
        let disposed = false;
        function connect() {
            ws = new WebSocket(window.location.origin.replace(/^http/, 'ws'));
            ws.onmessage = receiveMessage((_, message) => handleConnectionsMessage(message));
            ws.onopen = () => ws.send(JSON.stringify(usenetConnectionsTopic));
            ws.onerror = () => { ws.close() };
            ws.onclose = onClose;
            return () => { disposed = true; ws.close(); }
        }
        function onClose(e: CloseEvent) {
            !disposed && setTimeout(() => connect(), 1000);
            setConnections({});
        }
        return connect();
    }, [setConnections, handleConnectionsMessage]);

    // view
    return (
        <div className={'space-y-6'}>
            <div className={'space-y-4'}>
                <div className={'flex items-center justify-between text-lg font-semibold text-white'}>
                    <div>Usenet Providers</div>
                    <Button variant="primary" size="small" onClick={handleAddProvider}>
                        Add
                    </Button>
                </div>
                {providerConfig.Providers.length === 0 ? (
                    <p className={'rounded border border-slate-700/70 bg-slate-800/40 px-3 py-2 text-sm text-slate-400'}>
                        No Usenet providers configured.
                        Click on the "Add" button to get started.
                    </p>
                ) : (
                    <div className={'grid grid-cols-1 gap-4 lg:grid-cols-2'}>
                        {providerConfig.Providers.map((provider, index) => (
                            <div key={index} className={'rounded-lg bg-gray-800 shadow-md'}>
                                <div className={'p-3'}>
                                    <div className={'flex items-start justify-between gap-3'}>
                                        <div className={'min-w-0'}>
                                            <div className={'truncate font-semibold text-white'}>
                                                {provider.Host}
                                            </div>
                                            <div className={'mt-1 text-xs text-slate-400'}>
                                                Port {provider.Port}
                                            </div>
                                        </div>
                                        <div className={'flex gap-1'}>
                                            <button
                                                className={'rounded bg-white/10 p-1.5 text-slate-300 hover:bg-white/20'}
                                                onClick={() => handleEditProvider(index)}
                                                title="Edit Provider"
                                            >
                                                <Icon name="edit" className="!text-[18px]" />
                                            </button>
                                            <button
                                                className={`${'rounded bg-white/10 p-1.5 text-slate-300 hover:bg-white/20'} ${'hover:text-red-400'}`}
                                                onClick={() => handleDeleteProvider(index)}
                                                title="Delete Provider"
                                            >
                                                <Icon name="delete" className="!text-[18px]" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className={'mt-4 border-t border-slate-700/70 pt-3'}>
                                        <div className={'grid grid-cols-1 gap-3 sm:grid-cols-2'}>

                                            <div className={'relative flex min-w-0 items-center gap-2'}>
                                                <div className={'text-blue-400'}>
                                                    <Icon name="person" className="!text-[18px]" />
                                                </div>
                                                <div className={'flex min-w-0 flex-col'}>
                                                    <span className={'text-[11px] uppercase tracking-wide text-slate-500'}>Username</span>
                                                    <span className={'truncate text-sm text-slate-200'}>{provider.User}</span>
                                                </div>
                                            </div>

                                            <div className={'relative flex min-w-0 items-center gap-2'}>
                                                {connections[index] && (
                                                    <div className={'absolute inset-x-0 -top-1 h-1 overflow-hidden rounded bg-slate-700'}>
                                                        <div
                                                            className={'absolute inset-y-0 left-0 bg-emerald-700'}
                                                            style={{ width: `${100 * (connections[index].live / connections[index].max)}%` }}
                                                        />
                                                        <div
                                                            className={'absolute inset-y-0 left-0 bg-emerald-400'}
                                                            style={{ width: `${100 * (connections[index].active / connections[index].max)}%` }}
                                                        />
                                                    </div>
                                                )}
                                                <div className={'text-blue-400'}>
                                                    <Icon name="hub" className="!text-[18px]" />
                                                </div>
                                                <div className={'flex min-w-0 flex-col'}>
                                                    <span className={'text-[11px] uppercase tracking-wide text-slate-500'}>Max Connections</span>
                                                    <span className={'truncate text-sm text-slate-200'}>{provider.MaxConnections}</span>
                                                </div>
                                            </div>

                                            <div className={'relative flex min-w-0 items-center gap-2'}>
                                                <div className={'text-blue-400'}>
                                                    <Icon name={provider.UseSsl ? "lock" : "lock_open"} className="!text-[18px]" />
                                                </div>
                                                <div className={'flex min-w-0 flex-col'}>
                                                    <span className={'text-[11px] uppercase tracking-wide text-slate-500'}>Security</span>
                                                    <span className={'truncate text-sm text-slate-200'}>
                                                        {provider.UseSsl ? "SSL Enabled" : "No SSL"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className={'relative flex min-w-0 items-center gap-2'}>
                                                <div className={'text-blue-400'}>
                                                    <Icon name="account_tree" className="!text-[18px]" />
                                                </div>
                                                <div className={'flex min-w-0 flex-col'}>
                                                    <span className={'text-[11px] uppercase tracking-wide text-slate-500'}>Behavior</span>
                                                    <span className={'truncate text-sm text-slate-200'}>{PROVIDER_TYPE_LABELS[provider.Type]}</span>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <ProviderModal
                show={showModal}
                provider={editingIndex !== null ? providerConfig.Providers[editingIndex] : null}
                onClose={handleCloseModal}
                onSave={handleSaveProvider}
            />
        </div>
    );
}

type ProviderModalProps = {
    show: boolean;
    provider: ConnectionDetails | null;
    onClose: () => void;
    onSave: (provider: ConnectionDetails) => void;
};

function ProviderModal({ show, provider, onClose, onSave }: ProviderModalProps) {
    const [host, setHost] = useState(provider?.Host || "");
    const [port, setPort] = useState(provider?.Port?.toString() || "");
    const [useSsl, setUseSsl] = useState(provider?.UseSsl ?? true);
    const [user, setUser] = useState(provider?.User || "");
    const [pass, setPass] = useState(provider?.Pass || "");
    const [maxConnections, setMaxConnections] = useState(provider?.MaxConnections?.toString() || "");
    const [type, setType] = useState<ProviderType>(provider?.Type ?? ProviderType.Pooled);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [connectionTested, setConnectionTested] = useState(false);
    const [testError, setTestError] = useState<string | null>(null);
    const passIsMasked = isMaskedSecret(pass);

    // Reset form when modal opens or provider changes
    useEffect(() => {
        if (show) {
            setHost(provider?.Host || "");
            setPort(provider?.Port?.toString() || "");
            setUseSsl(provider?.UseSsl ?? true);
            setUser(provider?.User || "");
            setPass(provider?.Pass || "");
            setMaxConnections(provider?.MaxConnections?.toString() || "");
            setType(provider?.Type ?? ProviderType.Pooled);
            setConnectionTested(false);
            setTestError(null);
        }
    }, [show, provider]);

    // Handle Escape key to close modal
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && show) {
                onClose();
            }
        };

        if (show) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [show, onClose]);

    const handleTestConnection = useCallback(async () => {
        if (passIsMasked) return;

        setIsTestingConnection(true);
        setTestError(null);

        try {
            const formData = new FormData();
            formData.append('host', host);
            formData.append('port', port);
            formData.append('use-ssl', useSsl.toString());
            formData.append('user', user);
            formData.append('pass', pass);

            const response = await fetch('/api/test-usenet-connection', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                if (data.connected) {
                    setConnectionTested(true);
                    setTestError(null);
                } else {
                    setTestError("Connection test failed");
                }
            } else {
                setTestError("Failed to test connection");
            }
        } catch (error) {
            setTestError("Network error: " + (error instanceof Error ? error.message : "Unknown error"));
        } finally {
            setIsTestingConnection(false);
        }
    }, [host, port, useSsl, user, pass, passIsMasked]);

    const handleSave = useCallback(() => {
        onSave({
            Type: type,
            Host: host,
            Port: parseInt(port, 10),
            UseSsl: useSsl,
            User: user,
            Pass: pass,
            MaxConnections: parseInt(maxConnections, 10),
        });
    }, [type, host, port, useSsl, user, pass, maxConnections, onSave]);

    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    const isFormValid = host.trim() !== ""
        && isPositiveInteger(port)
        && user.trim() !== ""
        && pass.trim() !== ""
        && isPositiveInteger(maxConnections);

    const canSave = isFormValid && (connectionTested || passIsMasked || type == ProviderType.Disabled);

    if (!show) return null;

    return (
        <div className={'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4'} onClick={handleOverlayClick}>
            <div className={'max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded border border-slate-700 bg-slate-900 shadow-xl'}>
                <div className={'flex items-center justify-between border-b border-slate-700 px-4 py-3'}>
                    <h2 className={'text-lg font-semibold text-white'}>
                        {provider ? "Edit Provider" : "Add Provider"}
                    </h2>
                    <button className={'rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white'} onClick={onClose} aria-label="Close">
                        <Icon name="close" className="!text-[20px]" />
                    </button>
                </div>

                <div className={'p-4'}>
                    <div className={'grid grid-cols-1 gap-4 sm:grid-cols-2'}>
                        <div className={'space-y-2'}>
                            <label htmlFor="provider-host" className={'block text-sm font-medium text-slate-200'}>
                                Host
                            </label>
                            <input
                                type="text"
                                id="provider-host"
                                className={'form-input w-full'}
                                placeholder="news.provider.com"
                                value={host}
                                onChange={(e) => {
                                    setHost(e.target.value);
                                    setConnectionTested(false);
                                }}
                            />
                        </div>

                        <div className={'space-y-2'}>
                            <label htmlFor="provider-port" className={'block text-sm font-medium text-slate-200'}>
                                Port
                            </label>
                            <input
                                type="text"
                                id="provider-port"
                                className={`${'form-input w-full'} ${!isPositiveInteger(port) && port !== "" ? 'border-red-500 focus:border-red-500' : ""}`}
                                placeholder="563"
                                value={port}
                                onChange={(e) => {
                                    setPort(e.target.value);
                                    setConnectionTested(false);
                                }}
                            />
                        </div>

                        <div className={'space-y-2'}>
                            <label htmlFor="provider-user" className={'block text-sm font-medium text-slate-200'}>
                                Username
                            </label>
                            <input
                                type="text"
                                id="provider-user"
                                className={'form-input w-full'}
                                placeholder="username"
                                value={user}
                                onChange={(e) => {
                                    setUser(e.target.value);
                                    setConnectionTested(false);
                                }}
                            />
                        </div>

                        <div className={'space-y-2'}>
                            <label htmlFor="provider-pass" className={'block text-sm font-medium text-slate-200'}>
                                Password
                            </label>
                            <input
                                type="password"
                                id="provider-pass"
                                className={'form-input w-full'}
                                placeholder="password"
                                value={pass}
                                onChange={(e) => {
                                    setPass(e.target.value);
                                    setConnectionTested(false);
                                }}
                            />
                        </div>

                        <div className={'space-y-2'}>
                            <label htmlFor="provider-max-connections" className={'block text-sm font-medium text-slate-200'}>
                                Max Connections
                            </label>
                            <input
                                type="text"
                                id="provider-max-connections"
                                className={`${'form-input w-full'} ${!isPositiveInteger(maxConnections) && maxConnections !== "" ? 'border-red-500 focus:border-red-500' : ""}`}
                                placeholder="20"
                                value={maxConnections}
                                onChange={(e) => setMaxConnections(e.target.value)}
                            />
                        </div>

                        <div className={'space-y-2'}>
                            <label htmlFor="provider-type" className={'block text-sm font-medium text-slate-200'}>
                                Type
                            </label>
                            <select
                                id="provider-type"
                                className={'form-select w-full'}
                                value={type}
                                onChange={(e) => setType(parseInt(e.target.value, 10) as ProviderType)}
                            >
                                <option value={ProviderType.Disabled}>Disabled</option>
                                <option value={ProviderType.Pooled}>Pool Connections</option>
                                <option value={ProviderType.BackupOnly}>Backup Only</option>
                            </select>
                        </div>

                        <div className={`${'space-y-2'} ${'sm:col-span-2'}`}>
                            <div className={'flex items-center gap-2'}>
                                <input
                                    type="checkbox"
                                    id="provider-ssl"
                                    className={'h-4 w-4 rounded border-slate-600 bg-slate-950 accent-emerald-400'}
                                    checked={useSsl}
                                    onChange={(e) => {
                                        setUseSsl(e.target.checked);
                                        setConnectionTested(false);
                                    }}
                                />
                                <label htmlFor="provider-ssl" className={'text-sm text-slate-300'}>
                                    Use SSL
                                </label>
                            </div>
                        </div>
                    </div>

                    {testError && (
                        <div role="alert" className="mt-4 rounded border border-red-600/50 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                            {testError}
                        </div>
                    )}

                    {connectionTested && (
                        <div role="status" className="mt-4 rounded border border-emerald-600/50 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                            Connection test successful!
                        </div>
                    )}
                </div>

                <div className={'flex justify-end border-t border-slate-700 px-4 py-3'}>
                    <div className={'hidden'}></div>
                    <div className={'flex gap-2'}>
                        <Button variant="secondary" onClick={onClose}>
                            Cancel
                        </Button>
                        {!canSave ? (
                            <Button
                                variant="primary"
                                onClick={handleTestConnection}
                                disabled={!isFormValid || isTestingConnection}
                            >
                                {isTestingConnection ? "Testing..." : "Test Connection"}
                            </Button>
                        ) : (
                            <Button variant="primary" onClick={handleSave} disabled={!canSave}>
                                Save Provider
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function isUsenetSettingsUpdated(config: Record<string, string>, newConfig: Record<string, string>) {
    return config["usenet.providers"] !== newConfig["usenet.providers"]
}

export function isPositiveInteger(value: string) {
    const num = Number(value);
    return Number.isInteger(num) && num > 0 && value.trim() === num.toString();
}