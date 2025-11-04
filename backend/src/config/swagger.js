/**
 * Swagger/OpenAPI Configuration
 * Provides comprehensive API documentation setup
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const fs = require('fs');

// Get package.json for version info
let packageJson = {};
try {
  packageJson = require('../../../package.json');
} catch (error) {
  packageJson = {
    name: 'ai-agent-platform-backend',
    version: '1.0.0',
    description: 'AI Agent Platform Backend API'
  };
}

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: packageJson.name || 'AI Agent Platform API',
    version: packageJson.version || '1.0.0',
    description: packageJson.description || 'Comprehensive API for AI Agent Platform with authentication, file management, and AI services',
    contact: {
      name: 'API Support',
      email: process.env.SUPPORT_EMAIL || 'support@ai-agent-platform.com',
      url: process.env.SUPPORT_URL || 'https://ai-agent-platform.com/support'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    },
    termsOfService: process.env.TERMS_URL || 'https://ai-agent-platform.com/terms'
  },
  servers: [
    {
      url: process.env.API_BASE_URL || 'http://localhost:5000',
      description: 'Development server'
    },
    {
      url: process.env.STAGING_API_URL || 'https://staging-api.ai-agent-platform.com',
      description: 'Staging server'
    },
    {
      url: process.env.PRODUCTION_API_URL || 'https://api.ai-agent-platform.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for authentication'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for service-to-service authentication'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['status', 'message'],
        properties: {
          status: {
            type: 'string',
            enum: ['error', 'fail'],
            description: 'Error status'
          },
          message: {
            type: 'string',
            description: 'Error message'
          },
          code: {
            type: 'string',
            description: 'Error code'
          },
          details: {
            type: 'object',
            description: 'Additional error details'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Error timestamp'
          },
          requestId: {
            type: 'string',
            description: 'Request ID for tracking'
          }
        }
      },
      Success: {
        type: 'object',
        required: ['status', 'message'],
        properties: {
          status: {
            type: 'string',
            enum: ['success'],
            description: 'Success status'
          },
          message: {
            type: 'string',
            description: 'Success message'
          },
          data: {
            type: 'object',
            description: 'Response data'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Response timestamp'
          },
          requestId: {
            type: 'string',
            description: 'Request ID for tracking'
          }
        }
      },
      User: {
        type: 'object',
        required: ['id', 'email', 'username'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'User unique identifier'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 50,
            description: 'User username'
          },
          firstName: {
            type: 'string',
            maxLength: 100,
            description: 'User first name'
          },
          lastName: {
            type: 'string',
            maxLength: 100,
            description: 'User last name'
          },
          avatar: {
            type: 'string',
            format: 'uri',
            description: 'User avatar URL'
          },
          role: {
            type: 'string',
            enum: ['user', 'admin', 'moderator'],
            description: 'User role'
          },
          isActive: {
            type: 'boolean',
            description: 'User active status'
          },
          isVerified: {
            type: 'boolean',
            description: 'User email verification status'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'User creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'User last update timestamp'
          }
        }
      },
      AuthTokens: {
        type: 'object',
        required: ['accessToken', 'refreshToken'],
        properties: {
          accessToken: {
            type: 'string',
            description: 'JWT access token'
          },
          refreshToken: {
            type: 'string',
            description: 'JWT refresh token'
          },
          expiresIn: {
            type: 'integer',
            description: 'Token expiration time in seconds'
          },
          tokenType: {
            type: 'string',
            enum: ['Bearer'],
            description: 'Token type'
          }
        }
      },
      File: {
        type: 'object',
        required: ['id', 'filename', 'size', 'mimeType'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'File unique identifier'
          },
          filename: {
            type: 'string',
            description: 'Original filename'
          },
          size: {
            type: 'integer',
            description: 'File size in bytes'
          },
          mimeType: {
            type: 'string',
            description: 'File MIME type'
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'File access URL'
          },
          uploadedBy: {
            type: 'string',
            format: 'uuid',
            description: 'User ID who uploaded the file'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'File upload timestamp'
          }
        }
      },
      AIRequest: {
        type: 'object',
        required: ['prompt', 'model'],
        properties: {
          prompt: {
            type: 'string',
            description: 'AI prompt text'
          },
          model: {
            type: 'string',
            enum: ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'gemini-pro'],
            description: 'AI model to use'
          },
          maxTokens: {
            type: 'integer',
            minimum: 1,
            maximum: 4000,
            description: 'Maximum tokens to generate'
          },
          temperature: {
            type: 'number',
            minimum: 0,
            maximum: 2,
            description: 'Sampling temperature'
          },
          systemPrompt: {
            type: 'string',
            description: 'System prompt for context'
          }
        }
      },
      AIResponse: {
        type: 'object',
        required: ['id', 'response', 'model', 'usage'],
        properties: {
          id: {
            type: 'string',
            description: 'Response unique identifier'
          },
          response: {
            type: 'string',
            description: 'AI generated response'
          },
          model: {
            type: 'string',
            description: 'Model used for generation'
          },
          usage: {
            type: 'object',
            properties: {
              promptTokens: {
                type: 'integer',
                description: 'Tokens used in prompt'
              },
              completionTokens: {
                type: 'integer',
                description: 'Tokens used in completion'
              },
              totalTokens: {
                type: 'integer',
                description: 'Total tokens used'
              },
              cost: {
                type: 'number',
                description: 'Estimated cost in USD'
              }
            }
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Response creation timestamp'
          }
        }
      },
      HealthStatus: {
        type: 'object',
        required: ['status', 'timestamp'],
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'unhealthy', 'degraded'],
            description: 'Overall health status'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Health check timestamp'
          },
          uptime: {
            type: 'number',
            description: 'Application uptime in seconds'
          },
          version: {
            type: 'string',
            description: 'Application version'
          },
          checks: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['healthy', 'unhealthy']
                  },
                  responseTime: {
                    type: 'integer',
                    description: 'Response time in milliseconds'
                  }
                }
              },
              redis: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['healthy', 'unhealthy']
                  },
                  responseTime: {
                    type: 'integer',
                    description: 'Response time in milliseconds'
                  }
                }
              }
            }
          },
          metrics: {
            type: 'object',
            properties: {
              memory: {
                type: 'object',
                properties: {
                  used: {
                    type: 'integer',
                    description: 'Used memory in bytes'
                  },
                  total: {
                    type: 'integer',
                    description: 'Total memory in bytes'
                  },
                  percentage: {
                    type: 'number',
                    description: 'Memory usage percentage'
                  }
                }
              },
              requests: {
                type: 'object',
                properties: {
                  total: {
                    type: 'integer',
                    description: 'Total requests processed'
                  },
                  errors: {
                    type: 'integer',
                    description: 'Total error responses'
                  },
                  successRate: {
                    type: 'number',
                    description: 'Success rate percentage'
                  }
                }
              }
            }
          }
        }
      }
    },
    responses: {
      BadRequest: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              status: 'error',
              message: 'Invalid request parameters',
              code: 'VALIDATION_ERROR',
              timestamp: '2024-01-15T10:30:00Z',
              requestId: 'req_123456789'
            }
          }
        }
      },
      Unauthorized: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              status: 'error',
              message: 'Authentication required',
              code: 'UNAUTHORIZED',
              timestamp: '2024-01-15T10:30:00Z',
              requestId: 'req_123456789'
            }
          }
        }
      },
      Forbidden: {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              status: 'error',
              message: 'Insufficient permissions',
              code: 'FORBIDDEN',
              timestamp: '2024-01-15T10:30:00Z',
              requestId: 'req_123456789'
            }
          }
        }
      },
      NotFound: {
        description: 'Not Found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              status: 'error',
              message: 'Resource not found',
              code: 'NOT_FOUND',
              timestamp: '2024-01-15T10:30:00Z',
              requestId: 'req_123456789'
            }
          }
        }
      },
      InternalServerError: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              status: 'error',
              message: 'Internal server error',
              code: 'INTERNAL_ERROR',
              timestamp: '2024-01-15T10:30:00Z',
              requestId: 'req_123456789'
            }
          }
        }
      }
    },
    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        }
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20
        }
      },
      SortParam: {
        name: 'sort',
        in: 'query',
        description: 'Sort field and direction (e.g., createdAt:desc)',
        required: false,
        schema: {
          type: 'string',
          pattern: '^[a-zA-Z0-9_]+:(asc|desc)$'
        }
      },
      SearchParam: {
        name: 'search',
        in: 'query',
        description: 'Search query string',
        required: false,
        schema: {
          type: 'string',
          maxLength: 255
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization endpoints'
    },
    {
      name: 'Users',
      description: 'User management endpoints'
    },
    {
      name: 'Files',
      description: 'File upload and management endpoints'
    },
    {
      name: 'AI Services',
      description: 'AI model integration endpoints'
    },
    {
      name: 'Health',
      description: 'Application health and monitoring endpoints'
    },
    {
      name: 'Admin',
      description: 'Administrative endpoints'
    }
  ],
  externalDocs: {
    description: 'Find more info here',
    url: process.env.DOCS_URL || 'https://ai-agent-platform.com/docs'
  }
};

// Options for swagger-jsdoc
const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../middleware/*.js'),
    path.join(__dirname, '../models/*.js'),
    path.join(__dirname, '../controllers/*.js')
  ]
};

// Generate swagger specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Custom CSS for Swagger UI
const customCss = `
  .swagger-ui .topbar { display: none; }
  .swagger-ui .info .title { color: #3b82f6; }
  .swagger-ui .scheme-container { background: #f8fafc; padding: 20px; border-radius: 8px; }
  .swagger-ui .btn.authorize { background-color: #3b82f6; border-color: #3b82f6; }
  .swagger-ui .btn.authorize:hover { background-color: #2563eb; border-color: #2563eb; }
`;

// Swagger UI options
const swaggerUiOptions = {
  customCss,
  customSiteTitle: 'AI Agent Platform API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true
  }
};

// Export swagger setup function
const setupSwagger = (app) => {
  // Serve swagger documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  
  // Serve swagger.json
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  
  // Serve redoc documentation (alternative to swagger-ui)
  app.get('/redoc', (req, res) => {
    const redocHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>AI Agent Platform API Documentation</title>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
          <style>
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          <redoc spec-url='/api-docs.json'></redoc>
          <script src="https://cdn.jsdelivr.net/npm/redoc@2.0.0/bundles/redoc.standalone.js"></script>
        </body>
      </html>
    `;
    res.send(redocHtml);
  });
  
  console.log('📚 API Documentation available at:');
  console.log(`   Swagger UI: ${process.env.API_BASE_URL || 'http://localhost:5000'}/api-docs`);
  console.log(`   ReDoc: ${process.env.API_BASE_URL || 'http://localhost:5000'}/redoc`);
  console.log(`   JSON Spec: ${process.env.API_BASE_URL || 'http://localhost:5000'}/api-docs.json`);
};

// Generate OpenAPI spec file for external tools
const generateSpecFile = async () => {
  try {
    const specPath = path.join(__dirname, '../../../docs/openapi.json');
    const docsDir = path.dirname(specPath);
    
    // Ensure docs directory exists
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    // Write spec file
    fs.writeFileSync(specPath, JSON.stringify(swaggerSpec, null, 2));
    console.log(`📄 OpenAPI specification generated: ${specPath}`);
  } catch (error) {
    console.error('Failed to generate OpenAPI spec file:', error.message);
  }
};

module.exports = {
  swaggerSpec,
  setupSwagger,
  generateSpecFile,
  swaggerUiOptions
};