import gql from "graphql-tag";

const Signup = gql`
  mutation Signup($signUpInput: SignUpInput!) {
    register(signUpInput: $signUpInput) {
      id
      firstName
      lastName
    }
  }
`;

export default Signup;
