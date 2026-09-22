import gql from "graphql-tag";

const Signin = gql`
  mutation Signin($signInInput: SignInInput!) {
    login(signInInput: $signInInput) {
      id
      firstName
      lastName
      email
    }
  }
`;

export default Signin;
