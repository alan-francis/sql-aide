export default {
    head: (
      <>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta property="og:title" content="SQL Aide (SQLa)" />
        <meta property="og:description" content="SQL-first DX" />
      </>
    ),
    logo: <span>SQL Aide (SQLa) Documentation</span>,
    project: {
      link: 'https://github.com/netspective-labs/sql-aide'
    },
    docsRepositoryBase: 'https://github.com/netspective-labs/sql-aide/blob/main/support/docs-nextra',
    sidebar: { defaultMenuCollapseLevel: 1 },
    footer: {
      text: (
        <span>
          Copyright ©{' '} 1997-{new Date().getFullYear()} {' '}
          <a href="https://github.com/netspective-labs" target="_blank">
            Netspective Labs
          </a>
          . All rights reserved.
        </span>
      )
    }
  }

