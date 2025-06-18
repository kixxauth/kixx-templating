export default {
    site: {
        name: 'Kixx Templating',
    },
    page: {
        title: 'Kixx Templating Test',
        description: 'A test page for trying out Kixx Templating',
        openGraph: {
            type: 'article',
            title: 'Kixx Templating Test',
        },
    },
    navMenuSections: [
        {
            label: 'Fiction',
            pages: [
                {
                    label: 'Sci-fi',
                    url: '/books/sci-fi',
                },
            ],
        },
        {
            label: 'Nonfiction',
            pages: [
                {
                    label: 'Biographies',
                    url: '/books/biographies',
                },
                {
                    label: 'Self Help',
                    url: '/books/self-help',
                },
            ],
        },
    ],
    styles: {
        siteWidth: '1080px',
        layoutRightLeftMargin: '4vw',
    },
    article: {
        type: 'article',
        title: 'All about books',
        timezone: 'America/New_York',
        'Published Date': '2025-06-11T10:15:32.146Z',
        updated: '2025-06-11T10:15:32.146Z',
        copyright: { name: 'Dunder Mifflin', year: 1949 },
        tableOfContents: [],
        img: {
            srcset: [
                '/images/article-1/300w.jpg',
                '/images/article-1/600w.jpg',
                '/images/article-1/1200w.jpg',
            ],
        },
    },
    books: new Set([
        {
            title: 'The Great Gatsby',
            author: 'F. Scott Fitzgerald',
        },
        {
            title: 'To Kill a Mockingbird',
            author: 'Harper Lee',
        },
    ]),
};
