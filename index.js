const { ApolloServer, UserInputError, gql } = require('apollo-server')
// const { v1: uuid } = require('uuid')
require('dotenv').config()
const mongoose = require('mongoose')
const Book = require('./models/book')
const Author = require('./models/author')

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('connected to MongoDB'))
    .catch(err => console.err('connection to DB failed with error: ', err.message))

let authors = [
    {
        name: 'Robert Martin',
        id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
        born: 1952,
    },
    {
        name: 'Martin Fowler',
        id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
        born: 1963
    },
    {
        name: 'Fyodor Dostoevsky',
        id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
        born: 1821
    },
    {
        name: 'Joshua Kerievsky', // birthyear not known
        id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
    },
    {
        name: 'Sandi Metz', // birthyear not known
        id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
    },
]

/*
 * Suomi:
 * Saattaisi olla järkevämpää assosioida kirja ja sen tekijä tallettamalla kirjan yhteyteen tekijän nimen sijaan tekijän id
 * Yksinkertaisuuden vuoksi tallennamme kuitenkin kirjan yhteyteen tekijän nimen
 *
 * English:
 * It might make more sense to associate a book with its author by storing the author's name in the context of the book instead of the author's id
 * However, for simplicity, we will store the author's name in connection with the book
*/

let books = [
    {
        title: 'Clean Code',
        published: 2008,
        author: 'Robert Martin',
        id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
        genres: ['refactoring']
    },
    {
        title: 'Agile software development',
        published: 2002,
        author: 'Robert Martin',
        id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
        genres: ['agile', 'patterns', 'design']
    },
    {
        title: 'Refactoring, edition 2',
        published: 2018,
        author: 'Martin Fowler',
        id: "afa5de00-344d-11e9-a414-719c6709cf3e",
        genres: ['refactoring']
    },
    {
        title: 'Refactoring to patterns',
        published: 2008,
        author: 'Joshua Kerievsky',
        id: "afa5de01-344d-11e9-a414-719c6709cf3e",
        genres: ['refactoring', 'patterns']
    },
    {
        title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
        published: 2012,
        author: 'Sandi Metz',
        id: "afa5de02-344d-11e9-a414-719c6709cf3e",
        genres: ['refactoring', 'design']
    },
    {
        title: 'Crime and punishment',
        published: 1866,
        author: 'Fyodor Dostoevsky',
        id: "afa5de03-344d-11e9-a414-719c6709cf3e",
        genres: ['classic', 'crime']
    },
    {
        title: 'The Demon ',
        published: 1872,
        author: 'Fyodor Dostoevsky',
        id: "afa5de04-344d-11e9-a414-719c6709cf3e",
        genres: ['classic', 'revolution']
    },
]

const typeDefs = gql`
  type Book {
      title: String!
      published: Int!
      author: Author!
      genres: [String!]!
      id: ID!
  }
  type Author {
      name: String!
      born: Int
      bookCount: Int
      id: ID!
  }
  type Query {
      bookCount: Int!
      authorCount: Int!
      allBooks(author: String, genre: String): [Book!]!
      allAuthors: [Author!]!
  }
  type Mutation {
      addBook(
        title: String!
        author: String!
        published: Int!
        genres: [String!]!
      ): Book!
      editAuthor(
        name: String!
        setBornTo: Int!
      ): Author
  }
`

const resolvers = {
    Query: {
        bookCount: () => Book.collection.countDocuments(),
        authorCount: () => Author.collection.countDocuments(),
        allBooks: async (root, args) => {
            try {
                const filter = {}
                if (args.genre) {
                    filter.genres = { $in: [args.genre] }
                }
                const books = await Book.find(filter).populate('author')
                return books
            } catch (error) {
                console.error(error)
            }
        },
        allAuthors: async () => {
            try {
                const authors = await Author.find({})
                for (const author of authors) {
                    const bookCount = await Book.find({ author: author._id }).countDocuments()
                    author.bookCount = bookCount
                }
                return authors
            } catch (error) {
                console.error(error)
            }
        }
    },
    Mutation: {
        addBook: async (root, args) => {
            try {
                let author = await Author.findOne({ name: args.author })
                if (!author) {
                    const newAuthor = new Author({ name: args.author })
                    const savedAuthor = await newAuthor.save()
                    author = savedAuthor
                }
                const book = new Book({ ...args, author: author._id })
                const savedBook = await book.save()
                await savedBook.populate('author')
                return savedBook
            } catch (error) {
                if (error instanceof mongoose.Error.ValidationError) {
                    throw new UserInputError(`Invalid title or author name`, {
                        // invalidArgs: args.title || args.author,
                    })
                }
            }
        },
        editAuthor: async (root, args) => {
            try {
                const author = await Author.findOneAndUpdate({ name: args.name }, { born: args.setBornTo }, { new: true })
                if (!author) {
                    throw new Error('Author not found')
                }
                const bookCount = await Book.find({ author: author._id }).countDocuments()
                author.bookCount = bookCount
                return author
            } catch (error) {
                console.log(error.message)
            }

        }

    }
}

const server = new ApolloServer({
    typeDefs,
    resolvers,
})

server.listen().then(({ url }) => {
    console.log(`Server ready at ${url}`)
})