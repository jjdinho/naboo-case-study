import gql from "graphql-tag";

// Fetches the current user as Me, not the public User type. The name predates Me.
const GetUser = gql`
  query GetUser {
    getMe {
      id
      firstName
      lastName
      email
      role
    }
  }
`;

export default GetUser;
