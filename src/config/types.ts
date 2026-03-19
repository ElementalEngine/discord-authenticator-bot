export type NodeEnv = 'development' | 'test' | 'production';

export type SupportedGame = 'civ6' | 'civ7';

export interface CommandAccessPolicy {
  allowedChannelIds: readonly string[];
  requiredRoleIds?: readonly string[];
  allowDeveloperOverride?: boolean;
}

export interface AuthBotConfig {
  env: NodeEnv;
  requestTimeoutMs: number;
  backend: {
    baseUrl: string;
    serviceToken: string;
  };
  discord: {
    token: string;
    clientId: string;
    guildId: string;
    channels: {
      welcome: string;
      civ6Commands: string;
      civ7Commands: string;
      botCommands: string;
      authLog: string;
      registrationLog: string;
    };
    roles: {
      moderator: string;
      developer?: string;
      civ6Rank: string;
      civ7Rank: string;
      novice: string;
      nonVerified: string;
    };
  };
}
