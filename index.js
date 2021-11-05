const { ApolloServer, UserInputError, AuthenticationError, gql } = require('apollo-server')
// const { v1: uuid } = require('uuid')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const mongoose = require('mongoose')
const Book = require('./models/book')
const Author = require('./models/author')
const User = require('./models/user')

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('connected to MongoDB'))
    .catch(err => console.err('connection to DB failed with error: ', err.message))



const typeDefs = gql`
  type User {
      username: String!
      favoriteGenre: String!
      id: ID!
  }
  type Token {
      value: String!
  }
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
      me: User
  }
  type Mutation {
      createUser(
          username: String!
          favoriteGenre: String!
      ): User!
      login(
          username: String!
          password: String!
      ): Token
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
        me: (root, args, context) => context.currentUser, 
        bookCount: (root) => Book.collection.countDocuments(),
        authorCount: (root) => Author.collection.countDocuments(),
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
        allAuthors: async (root, args) => {
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
        createUser: async (root, args) => {
            try {
                const user = new User({ username: args.username, favoriteGenre: args.favoriteGenre })
                const savedUser = await user.save()
                return savedUser
            } catch (error) {
                throw new UserInputError(error.message, {
                    invalidArgs: args,
                  })
            }
        },
        login: async (root, args) => {
            try {
                const { username, password } = args
                const user = await User.findOne({ username })
                if (!user || password !== '1234') {
                    throw new Error('wrong credentials')
                }

                const userForToken = {
                    username: user.username,
                    id: user._id
                }

                const token = jwt.sign(userForToken, process.env.JWT_SECRET)

                return { value: token }
            } catch (error) {
                throw new UserInputError(error.message, {
                    invalidArgs: args,
                  })
            }
        },
        addBook: async (root, args, { currentUser }) => {
            if (!currentUser) {
                throw new AuthenticationError('not authenticated')
            }
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
                        invalidArgs: args
                    })
                }
            }
        },
        editAuthor: async (root, args, { currentUser }) => {
            if (!currentUser) {
                throw new AuthenticationError('not authenticated')
            }
            try {
                const author = await Author.findOneAndUpdate({ name: args.name }, { born: args.setBornTo }, { new: true })
                if (!author) {
                    throw new Error('Author not found')
                }
                const bookCount = await Book.find({ author: author._id }).countDocuments()
                author.bookCount = bookCount
                return author
            } catch (error) {
                throw new UserInputError(error.message, {
                    invalidArgs: args.author
                })
            }

        }

    }
}

const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({req}) => {
        const auth = req ? req.headers.authorization : null
    
        if (auth && req.headers.authorization.toLowerCase().startsWith('bearer ')) {
            const decodedToken = jwt.verify(
                auth.substring(7), process.env.JWT_SECRET
            )
            const currentUser = await User.findById(decodedToken.id)
            return { currentUser }
        }
    }
})

server.listen().then(({ url }) => {
    console.log(`Server ready at ${url}`)
})