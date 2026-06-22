export interface Document {
	id: string;
	name: string;
	description: string;
	uploadedAt: string;
	size: string;
}

export const documents: Document[] = [
	{
		id: 'doc-001',
		name: 'Lorem ipsum.pdf',
		description:
			'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequa...',
		uploadedAt: 'Dec 15, 2024',
		size: '16MB'
	},
	{
		id: 'doc-002',
		name: 'Project Roadmap Q1.docx',
		description:
			'Comprehensive quarterly roadmap covering sprint planning milestones, resource allocation across teams, and feature prioritization based on customer feedback and analytics data.',
		uploadedAt: 'Dec 14, 2024',
		size: '8MB'
	},
	{
		id: 'doc-003',
		name: 'API Documentation v2.pdf',
		description:
			'Full REST API reference including authentication flows, endpoint specifications, request and response schemas, rate limiting policies, and webhook integration guides.',
		uploadedAt: 'Dec 12, 2024',
		size: '24MB'
	},
	{
		id: 'doc-004',
		name: 'Brand Guidelines 2025.pdf',
		description:
			'Updated brand identity system covering logo usage, typography standards, color palettes, iconography, photography direction, and tone of voice across all digital and print channels.',
		uploadedAt: 'Dec 10, 2024',
		size: '42MB'
	},
	{
		id: 'doc-005',
		name: 'Financial Report Annual.pdf',
		description:
			'Annual financial performance review with revenue breakdowns, expense analysis, year-over-year growth metrics, cash flow projections, and stakeholder commentary.',
		uploadedAt: 'Dec 8, 2024',
		size: '12MB'
	},
	{
		id: 'doc-006',
		name: 'User Research Findings.txt',
		description:
			'Synthesis of qualitative and quantitative user research from interviews, surveys, and usability testing sessions conducted across three product verticals.',
		uploadedAt: 'Dec 5, 2024',
		size: '18MB'
	},
	{
		id: 'doc-007',
		name: 'Security Audit Report.pdf',
		description:
			'Penetration testing results and vulnerability assessment covering network infrastructure, application layer security, access control policies, and remediation recommendations.',
		uploadedAt: 'Dec 3, 2024',
		size: '9MB'
	},
	{
		id: 'doc-008',
		name: 'Onboarding Handbook.docx',
		description:
			'New employee onboarding guide including company culture overview, team structure, tooling setup instructions, communication protocols, and first-week checklist.',
		uploadedAt: 'Nov 28, 2024',
		size: '6MB'
	},
	{
		id: 'doc-009',
		name: 'Database Schema Design.pdf',
		description:
			'Entity-relationship diagrams and schema documentation for the production database, covering normalization decisions, indexing strategies, and migration planning.',
		uploadedAt: 'Nov 25, 2024',
		size: '14MB'
	},
	{
		id: 'doc-010',
		name: 'Marketing Campaign Brief.txt',
		description:
			'Campaign strategy document outlining target audience segments, messaging frameworks, channel distribution plans, budget allocation, and KPI tracking methodology.',
		uploadedAt: 'Nov 22, 2024',
		size: '7MB'
	},
	{
		id: 'doc-011',
		name: 'Infrastructure Topology.pdf',
		description:
			'Cloud infrastructure architecture diagrams including VPC configurations, load balancer setups, auto-scaling policies, CDN distribution, and disaster recovery procedures.',
		uploadedAt: 'Nov 18, 2024',
		size: '32MB'
	},
	{
		id: 'doc-012',
		name: 'Product Requirements Doc.pdf',
		description:
			'Detailed product requirements document covering user stories, acceptance criteria, technical constraints, timeline estimates, and dependency mapping across feature teams.',
		uploadedAt: 'Nov 15, 2024',
		size: '11MB'
	},
	{
		id: 'doc-013',
		name: 'Compliance Checklist.pdf',
		description:
			'Regulatory compliance verification checklist covering GDPR, SOC 2, HIPAA, and ISO 27001 requirements with implementation status and evidence documentation links.',
		uploadedAt: 'Nov 12, 2024',
		size: '5MB'
	},
	{
		id: 'doc-014',
		name: 'Design System Tokens.pdf',
		description:
			'Design token specification including spacing scales, color primitives, semantic color mappings, typography scales, elevation shadows, and motion timing curves.',
		uploadedAt: 'Nov 8, 2024',
		size: '19MB'
	},
	{
		id: 'doc-015',
		name: 'Incident Postmortem.pdf',
		description:
			'Post-incident analysis documenting root cause, timeline of events, impact assessment, resolution steps taken, and preventive measures for future system reliability.',
		uploadedAt: 'Nov 5, 2024',
		size: '3MB'
	}
];
