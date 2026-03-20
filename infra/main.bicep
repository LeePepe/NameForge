targetScope = 'resourceGroup'

@description('Azure region for the Singapore deployment.')
param location string = 'southeastasia'

@description('Container App name for the Singapore deployment.')
param containerAppName string = 'nameforge-sg'

@description('Container Apps environment name for the Singapore deployment.')
param containerAppEnvironmentName string = 'nameforge-sg-env'

@description('Log Analytics workspace name for the Singapore deployment.')
param logAnalyticsWorkspaceName string = 'nameforge-sg-logs'

@description('Repository name inside ACR.')
param imageRepository string = 'nameforge'

@description('Bootstrap image used before the application image is pushed.')
param containerImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('AI provider passed to the container.')
param llmProvider string = 'azure-foundry'

@description('Azure Foundry endpoint used by the app.')
param azureFoundryEndpoint string

@secure()
@description('Azure Foundry API key stored as a Container Apps secret.')
param azureFoundryApiKey string

@description('Azure Foundry deployment/model name.')
param azureFoundryDeployment string = 'Kimi-K2.5'

@description('Azure Foundry API version.')
param azureFoundryApiVersion string = '2024-12-01-preview'

@description('HTTP port exposed by the application.')
param containerPort int = 3001

@description('Minimum replicas for the Container App.')
param minReplicas int = 0

@description('Maximum replicas for the Container App.')
param maxReplicas int = 3

@description('Requested CPU cores for the container.')
param cpuCores string = '0.5'

@description('Requested memory for the container.')
param memory string = '1Gi'

var resourceToken = uniqueString(subscription().id, resourceGroup().id, containerAppName, location)
var acrName = toLower(replace('nameforgesg${resourceToken}', '-', ''))
var tags = {
  app: 'NameForge'
  deployment: 'singapore'
  region: location
  managedBy: 'bicep'
}

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  tags: tags
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
  }
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      maxInactiveRevisions: 100
      ingress: {
        allowInsecure: false
        external: true
        targetPort: containerPort
        transport: 'Auto'
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.listCredentials().username
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        {
          name: 'registry-password'
          value: containerRegistry.listCredentials().passwords[0].value
        }
        {
          name: 'azure-foundry-api-key'
          value: azureFoundryApiKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'nameforge'
          image: containerImage
          env: [
            {
              name: 'LLM_PROVIDER'
              value: llmProvider
            }
            {
              name: 'AZURE_FOUNDRY_ENDPOINT'
              value: azureFoundryEndpoint
            }
            {
              name: 'AZURE_FOUNDRY_API_KEY'
              secretRef: 'azure-foundry-api-key'
            }
            {
              name: 'AZURE_FOUNDRY_DEPLOYMENT'
              value: azureFoundryDeployment
            }
            {
              name: 'AZURE_FOUNDRY_API_VERSION'
              value: azureFoundryApiVersion
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'SERVE_STATIC'
              value: 'true'
            }
            {
              name: 'PORT'
              value: string(containerPort)
            }
          ]
          resources: {
            cpu: json(cpuCores)
            memory: memory
          }
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

output acrName string = containerRegistry.name
output acrLoginServer string = containerRegistry.properties.loginServer
output containerAppEnvironmentId string = containerAppsEnvironment.id
output containerAppName string = containerApp.name
output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output imageRepository string = imageRepository
output locationName string = location
